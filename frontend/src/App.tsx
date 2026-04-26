import { useState } from "react";
import { TripForm } from "./components/TripForm";
import { RouteMap } from "./components/RouteMap";
import { LogSheetViewer } from "./components/LogSheetViewer";
import { planTrip } from "./lib/api";
import type { PlanInputs, PlanResponse } from "./lib/types";
import { formatHoursMinutes } from "./lib/format";
import { useTheme } from "./lib/theme";
import "./App.css";

function App() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<PlanInputs | null>(null);
  const { isDark, toggle } = useTheme();

  async function handleSubmit(inputs: PlanInputs) {
    setLoading(true);
    setError(null);
    setLastInputs(inputs);
    try {
      const result = await planTrip(inputs);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-slate-950 transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <h1 className="text-base font-semibold text-ink dark:text-slate-100 leading-tight">
                ELD Trip Planner
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                Route + Hours-of-Service compliant daily logs
              </p>
            </div>
          </div>
          <ThemeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-4">
            <TripForm
              onSubmit={handleSubmit}
              isLoading={loading}
              defaults={lastInputs ?? undefined}
            />
            {data && <TotalsCard data={data} />}
          </aside>

          <section className="space-y-6 min-w-0">
            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {!data && !loading && !error && <EmptyState />}
            {loading && <LoadingState />}

            {data && (
              <>
                <RouteMap data={data} />
                <LogSheetViewer logs={data.daily_logs} />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-ink dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition"
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function TotalsCard({ data }: { data: PlanResponse }) {
  const t = data.totals;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200 dark:border-slate-800 p-5 transition-colors">
      <h3 className="text-sm font-semibold text-ink dark:text-slate-100 mb-3">Trip summary</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Distance" value={`${t.miles} mi`} />
        <Stat label="Driving" value={formatHoursMinutes(t.driving_seconds)} />
        <Stat label="On-duty total" value={formatHoursMinutes(t.on_duty_seconds)} />
        <Stat label="Days" value={String(t.days)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold text-ink dark:text-slate-100">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200 dark:border-slate-800 p-10 text-center transition-colors">
      <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-slate-500">
          <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-ink dark:text-slate-100">Plan your trip</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
        Enter current location, pickup, drop-off, and the hours you've already used in
        your 70-hour / 8-day cycle. We'll compute the route, required rest breaks,
        fuel stops, and draw your daily log sheets.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200 dark:border-slate-800 p-10 text-center transition-colors">
      <div className="mx-auto mb-4 w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      <h2 className="text-base font-semibold text-ink dark:text-slate-100">Planning your trip…</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Geocoding, routing, and applying HOS rules.
      </p>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#0f172a" />
      <path
        d="M5 10 H17 V21 H5 Z"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M17 14 H22 L26 17 V21 H17 Z"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M19 15 H22 L24.5 17 H19 Z" fill="#38bdf8" />
      <circle cx="9" cy="22.5" r="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
      <circle cx="22" cy="22.5" r="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

export default App;
