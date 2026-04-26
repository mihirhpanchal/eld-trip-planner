export type DutyStatus = "off_duty" | "sleeper" | "driving" | "on_duty";

export interface GeoPointDTO {
  label: string;
  lat: number;
  lon: number;
}

export interface LegDTO {
  origin_label: string;
  destination_label: string;
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  distance_miles: number;
  duration_seconds: number;
  geometry: [number, number][] | null; // GeoJSON ordering: [lon, lat], not Leaflet's [lat, lon].
}

export interface SegmentDTO {
  status: DutyStatus;
  start: string;
  end: string;
  duration_seconds: number;
  note: string;
  location_label: string;
  location_lat: number | null;
  location_lon: number | null;
  miles: number;
}

export interface DailyLogRemark {
  time: string;
  hour_fraction: number;
  label: string;
  note: string;
}

export interface DailyLog {
  date: string;
  day_start: string;
  segments: SegmentDTO[];
  totals: {
    off_duty: number;
    sleeper: number;
    driving: number;
    on_duty: number;
  };
  total_miles: number;
  remarks: DailyLogRemark[];
  from_location: string;
  to_location: string;
}

export interface PlanResponse {
  id: number;
  inputs: {
    current_location: string;
    pickup_location: string;
    dropoff_location: string;
    current_cycle_hours: number;
  };
  geocoded: {
    current: GeoPointDTO;
    pickup: GeoPointDTO;
    dropoff: GeoPointDTO;
  };
  legs: LegDTO[];
  segments: SegmentDTO[];
  daily_logs: DailyLog[];
  totals: {
    miles: number;
    driving_seconds: number;
    on_duty_seconds: number;
    trip_start: string | null;
    trip_end: string | null;
    days: number;
  };
}

export interface PlanInputs {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_hours: number;
}

export interface ApiError {
  detail: string;
  stage?: string;
}
