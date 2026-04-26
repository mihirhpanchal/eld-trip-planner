"""FMCSA Hours-of-Service constants for a property-carrying driver, no adverse
conditions. Durations are stored as seconds so the planner can do plain
arithmetic on a unix-timestamp timeline."""

HOUR = 3600
MINUTE = 60

# 11-hour driving limit after 10 consecutive hours off-duty.
MAX_DRIVING_PER_SHIFT = 11 * HOUR

# 14-hour on-duty window once the driver comes on duty.
MAX_ON_DUTY_WINDOW = 14 * HOUR

# 30-minute break required after 8 cumulative driving hours without a
# >=30 min interruption (off-duty / sleeper / on-duty-not-driving all count).
DRIVE_BEFORE_BREAK = 8 * HOUR
BREAK_DURATION = 30 * MINUTE

# 10 consecutive off-duty hours reset the shift.
OFF_DUTY_RESET = 10 * HOUR

# 70-hour / 8-day cycle.
CYCLE_HOURS = 70
CYCLE_DAYS = 8
CYCLE_LIMIT = CYCLE_HOURS * HOUR

# Fueling at least once per 1,000 miles, billed as 15 min on-duty not driving.
MILES_BETWEEN_FUEL = 1000.0
FUEL_STOP_DURATION = 15 * MINUTE

# 1 hour each for pickup and drop-off, billed as on-duty not driving.
PICKUP_DURATION = 1 * HOUR
DROPOFF_DURATION = 1 * HOUR

OFF_DUTY = "off_duty"
SLEEPER = "sleeper"
DRIVING = "driving"
ON_DUTY = "on_duty"

DUTY_ROW_INDEX = {
    OFF_DUTY: 0,
    SLEEPER: 1,
    DRIVING: 2,
    ON_DUTY: 3,
}

DUTY_LABEL = {
    OFF_DUTY: "Off Duty",
    SLEEPER: "Sleeper Berth",
    DRIVING: "Driving",
    ON_DUTY: "On Duty (not driving)",
}

DEFAULT_DEPARTURE_HOUR = 8
