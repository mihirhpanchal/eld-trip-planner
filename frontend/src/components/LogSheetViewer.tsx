import { useState } from "react";
import type { DailyLog } from "../lib/types";
import { DailyLogSheet } from "./DailyLogSheet";
import { formatDate } from "../lib/format";

interface Props {
  logs: DailyLog[];
}

export function LogSheetViewer({ logs }: Props) {
  const [index, setIndex] = useState(0);
  if (logs.length === 0) return null;
  const log = logs[index];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-ink dark:text-slate-100 mr-2">
          Daily Log Sheets ({logs.length})
        </h2>
        <div className="flex gap-1 overflow-x-auto scroll-inner">
          {logs.map((l, i) => (
            <button
              key={l.date}
              type="button"
              onClick={() => setIndex(i)}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition ${
                i === index
                  ? "bg-accent text-white border-accent"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              Day {i + 1} · {formatDate(l.date)}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(logs.length - 1, i + 1))}
          disabled={index === logs.length - 1}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Next →
        </button>
      </div>

      <DailyLogSheet log={log} dayNumber={index + 1} totalDays={logs.length} />
    </div>
  );
}
