import type { DutyStatus } from "./types";

export function formatHoursMinutes(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const dutyLabel: Record<DutyStatus, string> = {
  off_duty: "Off Duty",
  sleeper: "Sleeper Berth",
  driving: "Driving",
  on_duty: "On Duty (not driving)",
};

export const dutyColor: Record<DutyStatus, string> = {
  off_duty: "#94a3b8",
  sleeper: "#6366f1",
  driving: "#16a34a",
  on_duty: "#f59e0b",
};

export function shortLocation(label: string): string {
  if (!label) return "";
  const parts = label.split(",").map((p) => p.trim());
  if (parts.length <= 2) return parts.join(", ");
  return `${parts[0]}, ${parts[parts.length - 3] || parts[1]}`;
}
