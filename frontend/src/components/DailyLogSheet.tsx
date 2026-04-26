import type { DailyLog, DutyStatus } from "../lib/types";
import { formatClock, formatDate, formatHoursMinutes, shortLocation } from "../lib/format";
import { useTheme } from "../lib/theme";

// Geometry chosen to mirror the FMCSA paper log proportions.
const SHEET_WIDTH = 1100;
const SHEET_PADDING_X = 40;
const GRID_LEFT = 210;
const GRID_RIGHT = SHEET_WIDTH - 110;
const GRID_TOP = 240;
const ROW_HEIGHT = 34;
const GRID_WIDTH = GRID_RIGHT - GRID_LEFT;
const HOUR_WIDTH = GRID_WIDTH / 24;
const ROWS: DutyStatus[] = ["off_duty", "sleeper", "driving", "on_duty"];
const ROW_LABELS: Record<DutyStatus, string> = {
  off_duty: "1. Off Duty",
  sleeper: "2. Sleeper Berth",
  driving: "3. Driving",
  on_duty: "4. On Duty (not driving)",
};

const GRID_BOTTOM = GRID_TOP + ROW_HEIGHT * ROWS.length;
const REMARKS_TOP = GRID_BOTTOM + 80;
const REMARK_ROW_HEIGHT = 16;
const REMARK_LIST_TOP_OFFSET = 28;
const RECAP_GAP = 24;
const SHEET_BOTTOM_PADDING = 20;

interface Palette {
  bg: string;
  rowAltA: string;
  rowAltB: string;
  totalsBg: string;
  gridMajor: string;
  gridMinor: string;
  rowSep: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  fieldRule: string;
  remarkRule: string;
  dutyLine: string;
  dutyHalo: string;
}

const lightPalette: Palette = {
  bg: "#ffffff",
  rowAltA: "#f8fafc",
  rowAltB: "#ffffff",
  totalsBg: "#ffffff",
  gridMajor: "#94a3b8",
  gridMinor: "#e2e8f0",
  rowSep: "#475569",
  textPrimary: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  fieldRule: "#94a3b8",
  remarkRule: "#cbd5e1",
  dutyLine: "#1d4ed8",
  dutyHalo: "#ffffff",
};

const darkPalette: Palette = {
  bg: "#0f172a",
  rowAltA: "#1e293b",
  rowAltB: "#0f172a",
  totalsBg: "#0f172a",
  gridMajor: "#64748b",
  gridMinor: "#334155",
  rowSep: "#94a3b8",
  textPrimary: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  fieldRule: "#475569",
  remarkRule: "#475569",
  dutyLine: "#38bdf8",
  dutyHalo: "#0f172a",
};

interface Props {
  log: DailyLog;
  dayNumber: number;
  totalDays: number;
}

function xForHour(h: number) {
  return GRID_LEFT + h * HOUR_WIDTH;
}
function yForStatus(s: DutyStatus) {
  return GRID_TOP + ROWS.indexOf(s) * ROW_HEIGHT + ROW_HEIGHT / 2;
}


export function DailyLogSheet({ log, dayNumber, totalDays }: Props) {
  const { isDark } = useTheme();
  const p = isDark ? darkPalette : lightPalette;

  const points: { x: number; y: number; hour: number; status: DutyStatus }[] = [];
  const dayStart = new Date(log.day_start).getTime();

  for (const seg of log.segments) {
    const startHour = (new Date(seg.start).getTime() - dayStart) / 3_600_000;
    const endHour = (new Date(seg.end).getTime() - dayStart) / 3_600_000;
    const y = yForStatus(seg.status);
    points.push({ x: xForHour(startHour), y, hour: startHour, status: seg.status });
    points.push({ x: xForHour(endHour), y, hour: endHour, status: seg.status });
  }

  let d = "";
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (i === 0) {
      d += `M ${pt.x} ${pt.y}`;
    } else {
      const prev = points[i - 1];
      if (prev.y !== pt.y && prev.x === pt.x) {
        d += ` L ${pt.x} ${pt.y}`;
      } else if (prev.y !== pt.y) {
        d += ` L ${pt.x} ${prev.y} L ${pt.x} ${pt.y}`;
      } else {
        d += ` L ${pt.x} ${pt.y}`;
      }
    }
  }

  const sortedRemarks = log.remarks
    .slice()
    .sort((a, b) => a.hour_fraction - b.hour_fraction)
    .map((r, i) => ({
      ...r,
      number: i + 1,
      x: xForHour(Math.max(0, Math.min(24, r.hour_fraction))),
    }));

  const useTwoColumns = sortedRemarks.length > 9;
  const itemsPerColumn = useTwoColumns
    ? Math.ceil(sortedRemarks.length / 2)
    : sortedRemarks.length;

  const listTopY = REMARKS_TOP + REMARK_LIST_TOP_OFFSET;
  const listBottomY =
    itemsPerColumn > 0
      ? listTopY + (itemsPerColumn - 1) * REMARK_ROW_HEIGHT
      : listTopY;
  const recapTitleY = listBottomY + RECAP_GAP;
  const recapBodyY = recapTitleY + 16;
  const sheetHeight = recapBodyY + SHEET_BOTTOM_PADDING;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-ink dark:text-slate-100">
            Driver's Daily Log — Day {dayNumber} of {totalDays}
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(log.date)}</div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Drive: {formatHoursMinutes(log.totals.driving)}</span>
          <span>On duty: {formatHoursMinutes(log.totals.on_duty)}</span>
          <span>Sleeper: {formatHoursMinutes(log.totals.sleeper)}</span>
          <span>Off: {formatHoursMinutes(log.totals.off_duty)}</span>
          <span className="font-medium text-ink dark:text-slate-100">{log.total_miles} mi</span>
        </div>
      </div>

      <div className="overflow-x-auto scroll-inner" style={{ background: p.bg }}>
        <svg
          viewBox={`0 0 ${SHEET_WIDTH} ${sheetHeight}`}
          className="w-full min-w-[900px]"
          role="img"
          aria-label={`Daily log for ${log.date}`}
        >
          <rect x="0" y="0" width={SHEET_WIDTH} height={sheetHeight} fill={p.bg} />

          <text x={SHEET_PADDING_X} y="44" fontSize="22" fontWeight="700" fill={p.textPrimary}>
            Driver's Daily Log
          </text>
          <text x={SHEET_PADDING_X} y="64" fontSize="11" fill={p.textMuted}>
            (24 hours) — Original: File at home terminal. Duplicate: Driver retains in
            his/her possession for 8 days.
          </text>

          <HeaderField p={p} x={SHEET_PADDING_X} y={96} label="Date" value={formatDate(log.date)} width={260} />
          <HeaderField p={p} x={SHEET_PADDING_X + 280} y={96} label="From" value={shortLocation(log.from_location)} width={360} />
          <HeaderField p={p} x={SHEET_PADDING_X + 660} y={96} label="To" value={shortLocation(log.to_location)} width={360} />


          <HeaderField p={p} x={SHEET_PADDING_X} y={146} label="Total Miles Driving Today" value={String(log.total_miles)} width={220} />
          <HeaderField p={p} x={SHEET_PADDING_X + 240} y={146} label="Total Mileage Today" value={String(log.total_miles)} width={220} />
          <HeaderField p={p} x={SHEET_PADDING_X + 480} y={146} label="Name of Carrier" value="—" width={260} />
          <HeaderField p={p} x={SHEET_PADDING_X + 760} y={146} label="Main Office Address" value="—" width={260} />

          <HeaderField p={p} x={SHEET_PADDING_X} y={196} label="Truck/Tractor Numbers" value="—" width={460} />
          <HeaderField p={p} x={SHEET_PADDING_X + 480} y={196} label="Home Terminal Address" value="—" width={540} />

          {Array.from({ length: 25 }, (_, i) => (
            <g key={`hour-${i}`}>
              <text
                x={xForHour(i)}
                y={GRID_TOP - 8}
                fontSize="10"
                textAnchor="middle"
                fill={p.textSecondary}
              >
                {i === 0 ? "Mid" : i === 12 ? "Noon" : i === 24 ? "Mid" : i % 12 === 0 ? "12" : i % 12}
              </text>
            </g>
          ))}
          <text x={xForHour(0)} y={GRID_TOP - 22} fontSize="9" textAnchor="middle" fill={p.textMuted}>
            night
          </text>
          <text x={xForHour(24)} y={GRID_TOP - 22} fontSize="9" textAnchor="middle" fill={p.textMuted}>
            night
          </text>
          <text x={GRID_RIGHT + 55} y={GRID_TOP - 8} fontSize="10" textAnchor="middle" fill={p.textSecondary}>
            Total
          </text>
          <text x={GRID_RIGHT + 55} y={GRID_TOP + 4} fontSize="10" textAnchor="middle" fill={p.textSecondary}>
            Hours
          </text>

          {ROWS.map((row, i) => {
            const y = GRID_TOP + i * ROW_HEIGHT;
            return (
              <g key={row}>
                <rect
                  x={GRID_LEFT}
                  y={y}
                  width={GRID_WIDTH}
                  height={ROW_HEIGHT}
                  fill={i % 2 === 0 ? p.rowAltA : p.rowAltB}
                  stroke={p.gridMajor}
                  strokeWidth="1"
                />
                <text
                  x={GRID_LEFT - 8}
                  y={y + ROW_HEIGHT / 2 + 4}
                  fontSize="11"
                  fontWeight="500"
                  textAnchor="end"
                  fill={p.textSecondary}
                >
                  {ROW_LABELS[row]}
                </text>
                <rect
                  x={GRID_RIGHT}
                  y={y}
                  width={SHEET_WIDTH - GRID_RIGHT - SHEET_PADDING_X + 20}
                  height={ROW_HEIGHT}
                  fill={p.totalsBg}
                  stroke={p.gridMajor}
                  strokeWidth="1"
                />
                <text
                  x={GRID_RIGHT + 55}
                  y={y + ROW_HEIGHT / 2 + 4}
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                  fill={p.textPrimary}
                >
                  {formatHoursMinutes(log.totals[row])}
                </text>
              </g>
            );
          })}

          {Array.from({ length: 24 * 4 + 1 }, (_, i) => {
            const x = GRID_LEFT + (i * HOUR_WIDTH) / 4;
            const isHour = i % 4 === 0;
            const tickTop = GRID_TOP;
            const tickBottom = GRID_BOTTOM;
            return (
              <line
                key={`tick-${i}`}
                x1={x}
                x2={x}
                y1={tickTop}
                y2={tickBottom}
                stroke={isHour ? p.gridMajor : p.gridMinor}
                strokeWidth={isHour ? 1 : 0.5}
              />
            );
          })}

          {Array.from({ length: ROWS.length + 1 }, (_, i) => {
            const y = GRID_TOP + i * ROW_HEIGHT;
            return (
              <line
                key={`h-${i}`}
                x1={GRID_LEFT}
                x2={GRID_RIGHT}
                y1={y}
                y2={y}
                stroke={p.rowSep}
                strokeWidth={1}
              />
            );
          })}

          {/* Duty trace drawn twice: a halo for contrast, then the ink stroke
              on top so the line reads clearly above the grid in either theme. */}
          <path
            d={d}
            fill="none"
            stroke={p.dutyHalo}
            strokeWidth={6}
            strokeLinecap="square"
            strokeLinejoin="miter"
            opacity={0.95}
          />
          <path
            d={d}
            fill="none"
            stroke={p.dutyLine}
            strokeWidth={3.5}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />

          <text x={SHEET_PADDING_X} y={GRID_BOTTOM + 40} fontSize="12" fontWeight="700" fill={p.textPrimary}>
            Remarks
          </text>
          <line
            x1={GRID_LEFT}
            x2={GRID_RIGHT}
            y1={REMARKS_TOP}
            y2={REMARKS_TOP}
            stroke={p.remarkRule}
          />

          {sortedRemarks.map((r) => (
            <g key={`tick-${r.number}`}>
              <line
                x1={r.x}
                x2={r.x}
                y1={REMARKS_TOP - 10}
                y2={REMARKS_TOP}
                stroke={p.textMuted}
                strokeWidth="1"
              />
              <text
                x={r.x}
                y={REMARKS_TOP - 14}
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                fill={p.textSecondary}
              >
                {r.number}
              </text>
            </g>
          ))}

          {(() => {
            const listLeft = SHEET_PADDING_X;
            const colWidth = (SHEET_WIDTH - SHEET_PADDING_X * 2) / (useTwoColumns ? 2 : 1);
            return sortedRemarks.map((r) => {
              const col = useTwoColumns
                ? Math.floor((r.number - 1) / itemsPerColumn)
                : 0;
              const row = (r.number - 1) % itemsPerColumn;
              const x0 = listLeft + col * colWidth;
              const y = listTopY + row * REMARK_ROW_HEIGHT;
              return (
                <g key={`row-${r.number}`}>
                  <text
                    x={x0}
                    y={y}
                    fontSize="10"
                    fontWeight="700"
                    fill={p.textSecondary}
                  >
                    {r.number}.
                  </text>
                  <text
                    x={x0 + 24}
                    y={y}
                    fontSize="10"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill={p.textSecondary}
                  >
                    {formatClock(r.time)}
                  </text>
                  <text
                    x={x0 + 76}
                    y={y}
                    fontSize="10"
                    fontWeight="600"
                    fill={p.textPrimary}
                  >
                    {shortLocation(r.label)}
                  </text>
                  <text
                    x={x0 + 240}
                    y={y}
                    fontSize="10"
                    fill={p.textSecondary}
                  >
                    {r.note}
                  </text>
                </g>
              );
            });
          })()}

          <text x={SHEET_PADDING_X} y={recapTitleY} fontSize="10" fontWeight="700" fill={p.textPrimary}>
            Recap
          </text>
          <text x={SHEET_PADDING_X} y={recapBodyY} fontSize="10" fill={p.textSecondary}>
            Total on-duty today: {formatHoursMinutes(log.totals.driving + log.totals.on_duty)} ·
            Driving: {formatHoursMinutes(log.totals.driving)} ·
            Sleeper: {formatHoursMinutes(log.totals.sleeper)} ·
            Off-duty: {formatHoursMinutes(log.totals.off_duty)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function HeaderField({
  p,
  x,
  y,
  label,
  value,
  width,
}: {
  p: Palette;
  x: number;
  y: number;
  label: string;
  value: string;
  width: number;
}) {
  return (
    <g>
      <text x={x} y={y - 12} fontSize="9" fill={p.textMuted}>
        {label}
      </text>
      <line x1={x} x2={x + width} y1={y} y2={y} stroke={p.fieldRule} strokeWidth="1" />
      <text x={x + 4} y={y - 2} fontSize="12" fontWeight="500" fill={p.textPrimary}>
        {value || "—"}
      </text>
    </g>
  );
}
