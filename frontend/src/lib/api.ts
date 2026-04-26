import type { PlanInputs, PlanResponse } from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

export async function planTrip(inputs: PlanInputs): Promise<PlanResponse> {
  const resp = await fetch(`${BASE}/api/plan-trip/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });

  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`;
    try {
      const err = await resp.json();
      detail = err.detail || detail;
    } catch {
      /* swallow */
    }
    throw new Error(detail);
  }

  return resp.json();
}
