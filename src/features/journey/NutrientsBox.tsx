import { useState, type JSX } from 'react';
import { useT } from '../../i18n/t';
import type { Nutrients } from './schema';

type NutrientsBoxProps = {
  nutrients: Nutrients;
};

/** Collapsible digestion progress bars with breakdown + absorbed fills and screen-reader labels. */
export function NutrientsBox({ nutrients }: NutrientsBoxProps): JSX.Element {
  const tr = useT();
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  );

  const macroRows: readonly {
    key: 'carbs' | 'protein' | 'fat';
    label: string;
    value: number;
    color: string;
  }[] = [
    {
      key: 'carbs',
      label: tr('journey.carbs'),
      value: Math.round(nutrients.carbs),
      color: 'bg-amber-400',
    },
    {
      key: 'protein',
      label: tr('journey.protein'),
      value: Math.round(nutrients.protein),
      color: 'bg-rose-400',
    },
    {
      key: 'fat',
      label: tr('journey.fat'),
      value: Math.round(nutrients.fat),
      color: 'bg-emerald-400',
    },
  ];
  const absorbed = Math.round(nutrients.absorbed);
  const water = Math.round(nutrients.water);

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-slate-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        <span>{tr('journey.nutrients')}</span>
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
          {macroRows.map((row) => {
            const detail = tr('journey.brokenDown', {
              p: row.value,
              a: absorbed,
            });
            return (
              <div key={row.key} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-200">
                    {row.label}
                  </span>
                  <span className="tabular-nums text-slate-300">{detail}</span>
                </div>
                <div
                  role="meter"
                  aria-label={row.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.value}
                  aria-valuetext={`${row.label}: ${detail}`}
                  className="relative h-2 w-full overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className={`h-full rounded-full ${row.color} opacity-65 transition-all`}
                    style={{ width: `${row.value}%` }}
                  />
                  {absorbed > 0 ? (
                    <div
                      className="absolute inset-y-0.5 left-0 rounded-full bg-sky-300 transition-all"
                      style={{ width: `${Math.min(row.value, absorbed)}%` }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}

          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-slate-200">
                {tr('journey.water')}
              </span>
              <span className="tabular-nums text-slate-300">
                {tr('journey.absorbedWater', { p: water })}
              </span>
            </div>
            <div
              role="meter"
              aria-label={tr('journey.water')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={water}
              aria-valuetext={`${tr('journey.water')}: ${tr('journey.absorbedWater', { p: water })}`}
              className="relative h-2 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${water}%` }}
              />
            </div>
          </div>

          <p className="pt-0.5 text-[10px] text-slate-400">
            {tr('journey.nutrientsNote')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
