"""Walks the route legs and produces a duty-status timeline that satisfies
FMCSA 395 for a property-carrying driver. Times are kept as whole seconds so
the log-sheet builder can slice the timeline into 24-hour days without
floating-point drift."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from . import hos_rules as R


@dataclass
class Leg:
    origin_label: str
    destination_label: str
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    distance_miles: float
    duration_seconds: int
    # OSRM-style [[lon, lat], ...] polyline. Optional; not used for HOS math.
    geometry: Optional[list] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Segment:
    status: str
    start: datetime
    end: datetime
    note: str = ""
    location_label: str = ""
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    miles: float = 0.0

    @property
    def duration_seconds(self) -> int:
        return int((self.end - self.start).total_seconds())

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "duration_seconds": self.duration_seconds,
            "note": self.note,
            "location_label": self.location_label,
            "location_lat": self.location_lat,
            "location_lon": self.location_lon,
            "miles": round(self.miles, 1),
        }


@dataclass
class PlanResult:
    segments: List[Segment] = field(default_factory=list)
    total_miles: float = 0.0
    total_driving_seconds: int = 0
    total_on_duty_seconds: int = 0
    trip_start: Optional[datetime] = None
    trip_end: Optional[datetime] = None


class HOSPlanner:
    """Drives each leg in chunks, inserting breaks, 10-hour resets, fuel stops,
    and the 1-hour pickup/drop-off blocks where the HOS counters demand them.
    The four counters (drive_since_break, drive_this_shift, on_duty_window,
    cycle_on_duty) are the only state — every regulation falls out of comparing
    them against the constants in `hos_rules`."""

    def __init__(
        self,
        legs: List[Leg],
        current_cycle_hours_used: float,
        departure_time: Optional[datetime] = None,
    ):
        if not legs:
            raise ValueError("At least one leg is required")
        if current_cycle_hours_used < 0 or current_cycle_hours_used > R.CYCLE_HOURS:
            raise ValueError(
                f"current_cycle_hours_used must be between 0 and {R.CYCLE_HOURS}"
            )

        self.legs = legs
        self.cycle_on_duty = int(current_cycle_hours_used * R.HOUR)
        self.departure_time = departure_time or self._default_departure()

        self.drive_since_break = 0
        self.drive_this_shift = 0
        self.on_duty_window = 0
        self.shift_started_at: Optional[datetime] = None
        self.last_break_marker: Optional[datetime] = None

        self.segments: List[Segment] = []

    @staticmethod
    def _default_departure() -> datetime:
        # Anchor to 08:00 UTC tomorrow so the per-day log slices line up neatly.
        now = datetime.now(timezone.utc).replace(microsecond=0, second=0, minute=0)
        base = now.replace(hour=R.DEFAULT_DEPARTURE_HOUR)
        if base <= now:
            base += timedelta(days=1)
        return base

    def plan(self) -> PlanResult:
        cursor = self.departure_time
        self._start_shift(cursor)

        cursor = self._drive_leg(self.legs[0], cursor)
        cursor = self._add_on_duty(
            cursor,
            R.PICKUP_DURATION,
            note="Pickup",
            label=self.legs[0].destination_label,
            lat=self.legs[0].dest_lat,
            lon=self.legs[0].dest_lon,
        )

        if len(self.legs) >= 2:
            cursor = self._drive_leg(self.legs[1], cursor)
            last = self.legs[-1]
            cursor = self._add_on_duty(
                cursor,
                R.DROPOFF_DURATION,
                note="Drop-off",
                label=last.destination_label,
                lat=last.dest_lat,
                lon=last.dest_lon,
            )

        return self._build_result()

    def _drive_leg(self, leg: Leg, cursor: datetime) -> datetime:
        if leg.duration_seconds <= 0:
            return cursor

        total_seconds = leg.duration_seconds
        total_miles = leg.distance_miles
        # Miles per second — used to prorate miles across the chunks we slice
        # the leg into when an HOS rule forces an interruption.
        mps = total_miles / total_seconds if total_seconds else 0.0

        driven_on_leg = 0
        miles_since_fuel = 0.0

        while driven_on_leg < total_seconds:
            if self.cycle_on_duty >= R.CYCLE_LIMIT:
                cursor = self._take_34h_restart(cursor, leg)
                continue

            if self.drive_since_break >= R.DRIVE_BEFORE_BREAK:
                cursor = self._take_30min_break(cursor, leg, driven_on_leg, mps)
                continue

            if (
                self.drive_this_shift >= R.MAX_DRIVING_PER_SHIFT
                or self.on_duty_window >= R.MAX_ON_DUTY_WINDOW
            ):
                cursor = self._take_10h_off_duty(cursor, leg, driven_on_leg, mps)
                continue

            # Largest chunk we can drive before any of the four counters trips.
            budget = min(
                total_seconds - driven_on_leg,
                R.MAX_DRIVING_PER_SHIFT - self.drive_this_shift,
                R.MAX_ON_DUTY_WINDOW - self.on_duty_window,
                R.DRIVE_BEFORE_BREAK - self.drive_since_break,
                R.CYCLE_LIMIT - self.cycle_on_duty,
            )

            # If this chunk would cross the next 1,000-mile fuel threshold,
            # shorten it so the chunk ends exactly at the fuel stop.
            miles_this_chunk = budget * mps
            if miles_since_fuel + miles_this_chunk > R.MILES_BETWEEN_FUEL:
                remaining_miles = R.MILES_BETWEEN_FUEL - miles_since_fuel
                fuel_budget = int(remaining_miles / mps) if mps > 0 else budget
                budget = max(60, min(budget, fuel_budget))
                miles_this_chunk = budget * mps

            if budget <= 0:
                # Defensive: the guards above should keep budget > 0.
                break

            drive_end = cursor + timedelta(seconds=budget)
            start_label, start_lat, start_lon = self._interpolate(leg, driven_on_leg, total_seconds)
            self._add_segment(
                Segment(
                    status=R.DRIVING,
                    start=cursor,
                    end=drive_end,
                    note=f"Driving toward {leg.destination_label}",
                    location_label=start_label,
                    location_lat=start_lat,
                    location_lon=start_lon,
                    miles=miles_this_chunk,
                )
            )

            driven_on_leg += budget
            miles_since_fuel += miles_this_chunk
            self.drive_since_break += budget
            self.drive_this_shift += budget
            self.on_duty_window += budget
            self.cycle_on_duty += budget
            cursor = drive_end

            # >= (not ==) absorbs tiny float drift in miles_since_fuel.
            if miles_since_fuel >= R.MILES_BETWEEN_FUEL - 0.01 and driven_on_leg < total_seconds:
                label, lat, lon = self._interpolate(leg, driven_on_leg, total_seconds)
                cursor = self._add_on_duty(
                    cursor,
                    R.FUEL_STOP_DURATION,
                    note="Fuel stop",
                    label=label,
                    lat=lat,
                    lon=lon,
                )
                miles_since_fuel = 0.0

        return cursor

    def _start_shift(self, cursor: datetime) -> None:
        self.drive_since_break = 0
        self.drive_this_shift = 0
        self.on_duty_window = 0
        self.shift_started_at = cursor

    def _take_30min_break(
        self, cursor: datetime, leg: Leg, driven: int, mps: float
    ) -> datetime:
        label, lat, lon = self._interpolate(leg, driven, leg.duration_seconds)
        end = cursor + timedelta(seconds=R.BREAK_DURATION)
        self._add_segment(
            Segment(
                status=R.OFF_DUTY,
                start=cursor,
                end=end,
                note="30-minute break",
                location_label=label,
                location_lat=lat,
                location_lon=lon,
            )
        )
        # The break burns time on the 14h window but doesn't accrue cycle on-duty.
        self.on_duty_window += R.BREAK_DURATION
        self.drive_since_break = 0
        return end

    def _take_10h_off_duty(
        self, cursor: datetime, leg: Leg, driven: int, mps: float
    ) -> datetime:
        label, lat, lon = self._interpolate(leg, driven, leg.duration_seconds)
        end = cursor + timedelta(seconds=R.OFF_DUTY_RESET)
        # Modeled as sleeper berth — the realistic case for long-haul.
        self._add_segment(
            Segment(
                status=R.SLEEPER,
                start=cursor,
                end=end,
                note="10-hour reset (sleeper berth)",
                location_label=label,
                location_lat=lat,
                location_lon=lon,
            )
        )
        self._start_shift(end)
        return end

    def _take_34h_restart(self, cursor: datetime, leg: Leg) -> datetime:
        label = leg.origin_label
        end = cursor + timedelta(hours=34)
        self._add_segment(
            Segment(
                status=R.OFF_DUTY,
                start=cursor,
                end=end,
                note="34-hour restart",
                location_label=label,
                location_lat=leg.origin_lat,
                location_lon=leg.origin_lon,
            )
        )
        self.cycle_on_duty = 0
        self._start_shift(end)
        return end

    def _add_on_duty(
        self,
        cursor: datetime,
        duration: int,
        note: str,
        label: str,
        lat: Optional[float],
        lon: Optional[float],
    ) -> datetime:
        # Take a 10h reset first if this block would blow the 14h window or 70h cycle.
        if (
            self.on_duty_window + duration > R.MAX_ON_DUTY_WINDOW
            or self.cycle_on_duty + duration > R.CYCLE_LIMIT
        ):
            end = cursor + timedelta(seconds=R.OFF_DUTY_RESET)
            self._add_segment(
                Segment(
                    status=R.SLEEPER,
                    start=cursor,
                    end=end,
                    note="10-hour reset before pickup/drop-off window closes",
                    location_label=label,
                    location_lat=lat,
                    location_lon=lon,
                )
            )
            self._start_shift(end)
            cursor = end

        end = cursor + timedelta(seconds=duration)
        self._add_segment(
            Segment(
                status=R.ON_DUTY,
                start=cursor,
                end=end,
                note=note,
                location_label=label,
                location_lat=lat,
                location_lon=lon,
            )
        )
        # Pickup/drop-off (60 min) qualify as the >=30 min interruption and
        # reset drive-since-break; a 15 min fuel stop does not.
        if duration >= R.BREAK_DURATION:
            self.drive_since_break = 0
        self.on_duty_window += duration
        self.cycle_on_duty += duration
        return end

    def _interpolate(self, leg: Leg, driven: int, total: int):
        # Straight-line interpolation between endpoints. Plenty accurate for
        # remarks / map pins; the polyline isn't sampled.
        if total <= 0:
            t = 0.0
        else:
            t = max(0.0, min(1.0, driven / total))
        lat = leg.origin_lat + (leg.dest_lat - leg.origin_lat) * t
        lon = leg.origin_lon + (leg.dest_lon - leg.origin_lon) * t
        if t <= 0.0:
            label = leg.origin_label
        elif t >= 1.0:
            label = leg.destination_label
        else:
            o = leg.origin_label.split(",")[0].strip()
            d = leg.destination_label.split(",")[0].strip()
            pct = int(t * 100)
            label = f"En route {o} → {d} ({pct}%)"
        return label, round(lat, 5), round(lon, 5)

    def _add_segment(self, seg: Segment) -> None:
        # Coalesce with the previous segment when they share status, note, and
        # endpoints — keeps the timeline compact for downstream consumers.
        if (
            self.segments
            and self.segments[-1].status == seg.status
            and self.segments[-1].note == seg.note
            and self.segments[-1].end == seg.start
        ):
            self.segments[-1].end = seg.end
            self.segments[-1].miles += seg.miles
            return
        self.segments.append(seg)

    def _build_result(self) -> PlanResult:
        total_miles = sum(s.miles for s in self.segments)
        total_drive = sum(s.duration_seconds for s in self.segments if s.status == R.DRIVING)
        total_on_duty = sum(
            s.duration_seconds
            for s in self.segments
            if s.status in (R.DRIVING, R.ON_DUTY)
        )
        return PlanResult(
            segments=self.segments,
            total_miles=round(total_miles, 1),
            total_driving_seconds=total_drive,
            total_on_duty_seconds=total_on_duty,
            trip_start=self.segments[0].start if self.segments else None,
            trip_end=self.segments[-1].end if self.segments else None,
        )
