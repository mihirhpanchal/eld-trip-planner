import { useState } from "react";
import type { PlanInputs } from "../lib/types";

interface Props {
  onSubmit: (inputs: PlanInputs) => void;
  isLoading: boolean;
  defaults?: Partial<PlanInputs>;
}

export function TripForm({ onSubmit, isLoading, defaults }: Props) {
  const [current, setCurrent] = useState(defaults?.current_location ?? "");
  const [pickup, setPickup] = useState(defaults?.pickup_location ?? "");
  const [dropoff, setDropoff] = useState(defaults?.dropoff_location ?? "");
  const [cycle, setCycle] = useState<string>(
    defaults?.current_cycle_hours != null ? String(defaults.current_cycle_hours) : "0"
  );

  const canSubmit =
    current.trim() && pickup.trim() && dropoff.trim() && !isLoading;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      current_location: current.trim(),
      pickup_location: pickup.trim(),
      dropoff_location: dropoff.trim(),
      current_cycle_hours: Number(cycle) || 0,
    });
  }

  function fillExample() {
    setCurrent("Los Angeles, CA");
    setPickup("Las Vegas, NV");
    setDropoff("Denver, CO");
    setCycle("10");
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200 dark:border-slate-800 p-6 space-y-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink dark:text-slate-100">Plan a trip</h2>
        <button
          type="button"
          onClick={fillExample}
          className="text-xs text-accent hover:underline"
        >
          Fill example
        </button>
      </div>

      <Field
        label="Current location"
        hint="Where the driver is right now"
        value={current}
        onChange={setCurrent}
        placeholder="e.g. Los Angeles, CA"
      />
      <Field
        label="Pickup location"
        value={pickup}
        onChange={setPickup}
        placeholder="e.g. Phoenix, AZ"
      />
      <Field
        label="Drop-off location"
        value={dropoff}
        onChange={setDropoff}
        placeholder="e.g. Dallas, TX"
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Current cycle hours used
          <span className="text-slate-400 dark:text-slate-500 font-normal"> · 0–70 hrs</span>
        </label>
        <input
          type="number"
          min={0}
          max={70}
          step={0.25}
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full mt-2 bg-accent text-white rounded-lg py-2.5 font-medium text-sm hover:bg-blue-700 transition disabled:bg-slate-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Spinner />
            Planning…
          </>
        ) : (
          "Plan trip"
        )}
      </button>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        Property-carrying driver · 70 hrs / 8 days · 11h drive / 14h window / 30-min
        break · fuel every 1,000 mi · 1h pickup &amp; 1h drop-off.
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
        {label}
        {hint && <span className="text-slate-400 dark:text-slate-500 font-normal"> · {hint}</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent placeholder:text-slate-400 dark:placeholder:text-slate-500"
        autoComplete="off"
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
