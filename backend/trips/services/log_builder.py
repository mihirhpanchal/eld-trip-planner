"""Slices an HOS timeline into per-day log sheets that each cover exactly
00:00–24:00 UTC. The first and last days are padded with off-duty so every
sheet sums to 24 hours, matching how a paper log is filled out."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from .hos_planner import Segment
from . import hos_rules as R


def _day_boundary(ts: datetime) -> datetime:
    return ts.replace(hour=0, minute=0, second=0, microsecond=0)


def build_daily_logs(segments: List[Segment]) -> list:
    if not segments:
        return []

    # Pad with off-duty so day 0 starts at 00:00 and the last day ends at 24:00.
    first_start = segments[0].start
    last_end = segments[-1].end
    day0 = _day_boundary(first_start)
    final_day_end = _day_boundary(last_end) + timedelta(days=1)

    padded: List[Segment] = []
    if day0 < first_start:
        padded.append(
            Segment(
                status=R.OFF_DUTY,
                start=day0,
                end=first_start,
                note="",
                location_label=segments[0].location_label or "Home terminal",
            )
        )
    padded.extend(segments)
    if last_end < final_day_end:
        padded.append(
            Segment(
                status=R.OFF_DUTY,
                start=last_end,
                end=final_day_end,
                note="",
                location_label=segments[-1].location_label or "Home terminal",
            )
        )

    split: List[Segment] = []
    for seg in padded:
        cursor = seg.start
        while cursor < seg.end:
            next_mid = _day_boundary(cursor) + timedelta(days=1)
            chunk_end = min(next_mid, seg.end)
            chunk_duration = (chunk_end - cursor).total_seconds()
            if seg.status == R.DRIVING and seg.duration_seconds > 0:
                miles = seg.miles * (chunk_duration / seg.duration_seconds)
            else:
                miles = 0.0
            split.append(
                Segment(
                    status=seg.status,
                    start=cursor,
                    end=chunk_end,
                    note=seg.note,
                    location_label=seg.location_label,
                    location_lat=seg.location_lat,
                    location_lon=seg.location_lon,
                    miles=miles,
                )
            )
            cursor = chunk_end

    logs = []
    current_day = day0
    while current_day < final_day_end:
        day_segments = [s for s in split if s.start >= current_day and s.end <= current_day + timedelta(days=1)]
        if not day_segments:
            current_day += timedelta(days=1)
            continue

        totals = {R.OFF_DUTY: 0, R.SLEEPER: 0, R.DRIVING: 0, R.ON_DUTY: 0}
        miles = 0.0
        remarks = []
        for s in day_segments:
            totals[s.status] += s.duration_seconds
            miles += s.miles
            if s.note and s.location_label:
                remarks.append(
                    {
                        "time": s.start.isoformat(),
                        "hour_fraction": _hour_fraction(s.start, current_day),
                        "label": s.location_label,
                        "note": s.note,
                    }
                )

        locs = [s.location_label for s in day_segments if s.location_label]
        from_loc = locs[0] if locs else ""
        to_loc = locs[-1] if locs else ""

        logs.append(
            {
                "date": current_day.date().isoformat(),
                "day_start": current_day.isoformat(),
                "segments": [s.to_dict() for s in day_segments],
                "totals": {
                    "off_duty": totals[R.OFF_DUTY],
                    "sleeper": totals[R.SLEEPER],
                    "driving": totals[R.DRIVING],
                    "on_duty": totals[R.ON_DUTY],
                },
                "total_miles": round(miles, 1),
                "remarks": remarks,
                "from_location": from_loc,
                "to_location": to_loc,
            }
        )
        current_day += timedelta(days=1)

    return logs


def _hour_fraction(ts: datetime, day_start: datetime) -> float:
    # Position within the day on a 0.0–24.0 scale; the SVG uses it as the x-coord.
    delta = (ts - day_start).total_seconds()
    return round(delta / R.HOUR, 4)
