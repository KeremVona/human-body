import { useState, type JSX } from 'react';
import { getActiveLocale, useT } from '../../i18n/t';
import type { LocalizedMeterText } from './localizeJourneys';
import type { MeterDef, MeterId } from './schema';

type MetersBoxProps = {
  meters: readonly MeterDef[];
  values: Record<MeterId, number>;
  title?: string;
  note?: string;
  meterTexts?: Record<MeterId, LocalizedMeterText>;
  defaultOpen?: boolean;
};

const ROW_COLORS = [
  'bg-amber-400',
  'bg-rose-400',
  'bg-emerald-400',
  'bg-sky-400',
] as const;

function formatMeterNum(
  value: number,
  decimals: 0 | 1 | 2,
  locale: string,
): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
  }).format(safe);
}

function formatMeterTemplate(
  template: string | undefined,
  primary: string,
  secondary: string,
  unit: '%' | 'relative',
): string {
  if (!template) {
    return unit === '%' ? `${primary}%` : primary;
  }
  return template.replace('{v}', primary).replace('{s}', secondary);
}

/** Collapsible journey meter box driven by generic meter defs and localized templates. */
export function MetersBox({
  meters,
  values,
  title,
  note,
  meterTexts,
  defaultOpen,
}: MetersBoxProps): JSX.Element {
  const tr = useT();
  const locale = getActiveLocale();
  const [open, setOpen] = useState(
    () =>
      defaultOpen ??
      (typeof window !== 'undefined' ? window.innerWidth >= 640 : true),
  );

  const byId = new Map(meters.map((m) => [m.id, m]));
  const secondaryIds = new Set(
    meters.map((m) => m.secondary).filter((s): s is MeterId => s !== undefined),
  );
  const rows = meters.filter((m) => !secondaryIds.has(m.id));

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-slate-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        <span>{title ?? tr('journey.section')}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          {rows.map((meter, idx) => {
            const rawVal = values[meter.id] ?? 0;
            const secDef = meter.secondary
              ? byId.get(meter.secondary)
              : undefined;
            const rawSec = meter.secondary ? (values[meter.secondary] ?? 0) : 0;

            const vStr = formatMeterNum(rawVal, meter.decimals, locale);
            const sStr = secDef
              ? formatMeterNum(rawSec, secDef.decimals, locale)
              : '';

            const textEntry = meterTexts?.[meter.id];
            const label = textEntry?.label ?? meter.id;
            const detail = formatMeterTemplate(
              textEntry?.value,
              vStr,
              sStr,
              meter.unit,
            );

            const pct = Math.max(
              0,
              Math.min(100, (rawVal / meter.max) * 100),
            );
            const secPct = secDef
              ? Math.max(0, Math.min(pct, (rawSec / secDef.max) * 100))
              : 0;
            const roundedVal = Number(rawVal.toFixed(meter.decimals));
            const color = ROW_COLORS[idx % ROW_COLORS.length];

            return (
              <div key={meter.id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-200">{label}</span>
                  <span className="tabular-nums text-slate-300">{detail}</span>
                </div>
                <div
                  role="meter"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={meter.max}
                  aria-valuenow={roundedVal}
                  aria-valuetext={`${label}: ${detail}`}
                  className="relative h-2 w-full overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className={`h-full rounded-full ${color} opacity-65 transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                  {secDef && secPct > 0 ? (
                    <div
                      className="absolute inset-y-0.5 left-0 rounded-full bg-sky-300 transition-all"
                      style={{ width: `${secPct}%` }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}

          {note ? (
            <p className="text-[10px] text-slate-400">{note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
