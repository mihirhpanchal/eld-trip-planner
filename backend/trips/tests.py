from datetime import datetime, timezone
from django.test import TestCase

from trips.services.hos_planner import HOSPlanner, Leg
from trips.services import hos_rules as R
from trips.services.log_builder import build_daily_logs


def _leg(distance_miles, hours, origin="A", dest="B"):
    return Leg(
        origin_label=origin,
        destination_label=dest,
        origin_lat=40.0,
        origin_lon=-100.0,
        dest_lat=41.0,
        dest_lon=-101.0,
        distance_miles=distance_miles,
        duration_seconds=int(hours * R.HOUR),
    )


class ShortTripTest(TestCase):
    def test_short_trip_fits_in_one_shift(self):
        start = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
        legs = [_leg(100, 2, "Home", "Pickup"), _leg(200, 4, "Pickup", "Dropoff")]
        result = HOSPlanner(legs, current_cycle_hours_used=0, departure_time=start).plan()

        self.assertGreater(len(result.segments), 0)
        self.assertFalse(
            any(s.status == R.SLEEPER for s in result.segments),
            "Short trip unexpectedly required a sleeper reset",
        )
        self.assertLess(
            (result.trip_end - result.trip_start).total_seconds(),
            24 * R.HOUR,
        )


class LongTripTest(TestCase):
    def test_long_trip_inserts_rest_periods(self):
        start = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
        legs = [_leg(50, 1, "Home", "Pickup"), _leg(2500, 45, "Pickup", "Dropoff")]
        result = HOSPlanner(legs, current_cycle_hours_used=0, departure_time=start).plan()

        sleeper_count = sum(1 for s in result.segments if s.status == R.SLEEPER)
        break_count = sum(
            1
            for s in result.segments
            if s.status == R.OFF_DUTY and "30-minute break" in s.note
        )
        self.assertGreaterEqual(sleeper_count, 3)
        self.assertGreaterEqual(break_count, 3)

    def test_fuel_stops_inserted(self):
        start = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
        legs = [_leg(10, 0.2, "Home", "Pickup"), _leg(2100, 35, "Pickup", "Dropoff")]
        result = HOSPlanner(legs, current_cycle_hours_used=0, departure_time=start).plan()

        fuel = [s for s in result.segments if s.note == "Fuel stop"]
        self.assertGreaterEqual(len(fuel), 2)


class CycleLimitTest(TestCase):
    def test_driver_near_cycle_limit_takes_34h_restart(self):
        start = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
        legs = [_leg(50, 1, "Home", "Pickup"), _leg(600, 10, "Pickup", "Dropoff")]
        result = HOSPlanner(legs, current_cycle_hours_used=68, departure_time=start).plan()

        restarts = [s for s in result.segments if "34-hour restart" in s.note]
        self.assertGreaterEqual(len(restarts), 1)


class LogBuilderTest(TestCase):
    def test_long_trip_produces_multiple_daily_logs(self):
        start = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)
        legs = [_leg(50, 1, "Home", "Pickup"), _leg(2500, 45, "Pickup", "Dropoff")]
        result = HOSPlanner(legs, current_cycle_hours_used=0, departure_time=start).plan()
        logs = build_daily_logs(result.segments)

        self.assertGreaterEqual(len(logs), 4)
        for log in logs:
            total = sum(s["duration_seconds"] for s in log["segments"])
            self.assertEqual(total, 24 * R.HOUR)
        for log in logs:
            totals = log["totals"]
            total = sum(totals.values())
            self.assertEqual(total, 24 * R.HOUR)
