import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { useId, useState, type JSX } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { RootState } from '../../app/store';
import { Panel } from '../../ui/Panel';
import { retryBundle, selectBundlesForSystem } from '../assets/assetsSlice';
import { selectToggleRows, type ToggleRow } from './selectors';
import { opacitySet, systemToggled, uiGroupToggled } from './systemsSlice';

function startsCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 767px)').matches;
  }
  return window.innerWidth < 768;
}

/** Floating system-visibility toggles with bundle loading spinners and retry controls. */
export function SystemsPanel(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const rows = useAppSelector(selectToggleRows);
  const uiGroups = useAppSelector((s) => s.content.taxonomy?.uiGroups ?? []);
  const [collapsed, setCollapsed] = useState(startsCollapsed);
  const baseId = useId();

  if (rows.length === 0) {
    return null;
  }

  const groupIds = new Set(uiGroups.map((g) => g.id));

  const handleToggleRow = (row: ToggleRow) => {
    if (groupIds.has(row.id)) {
      dispatch(uiGroupToggled(row.id));
    } else if (row.systems[0]) {
      dispatch(systemToggled(row.systems[0]));
    }
  };

  const handleRetryRow = (row: ToggleRow) => {
    const state = store.getState();
    const errored = new Set<string>();
    for (const sys of row.systems) {
      for (const bundleId of selectBundlesForSystem(state, sys)) {
        if (state.assets.bundles[bundleId] === 'error') {
          errored.add(bundleId);
        }
      }
    }
    for (const bundleId of errored) {
      dispatch(retryBundle(bundleId));
    }
  };

  return (
    <section
      aria-label="Body systems"
      className="fixed top-14 left-3 z-10 sm:top-16 sm:left-4"
    >
      <Panel
        side="left"
        label="Body systems"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        className={collapsed ? '' : 'w-60'}
      >
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const switchId = `${baseId}-${row.id}`;
            const labelId = `${baseId}-${row.id}-label`;
            const pct = Math.round(row.opacity * 100);

            return (
              <li key={row.id} className="space-y-1 py-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: row.color }}
                    />
                    <label
                      id={labelId}
                      htmlFor={switchId}
                      className="cursor-pointer truncate text-sm text-slate-100 select-none"
                    >
                      {row.label}
                    </label>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {row.status === 'loading' ? (
                      <span
                        role="status"
                        aria-label={`Loading ${row.label}`}
                        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400 motion-reduce:animate-none"
                      />
                    ) : null}

                    {row.status === 'error' ? (
                      <button
                        type="button"
                        aria-label={`Retry ${row.label}`}
                        onClick={() => handleRetryRow(row)}
                        className="rounded bg-red-900/70 px-1.5 py-0.5 text-xs font-medium text-red-100 hover:bg-red-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      >
                        Retry
                      </button>
                    ) : null}

                    <Switch.Root
                      id={switchId}
                      checked={row.on === true}
                      aria-checked={row.on === 'mixed' ? 'mixed' : row.on}
                      aria-labelledby={labelId}
                      onCheckedChange={() => handleToggleRow(row)}
                      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-slate-700/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 data-[state=checked]:bg-sky-500"
                    >
                      <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-4" />
                    </Switch.Root>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-4.5">
                  <Slider.Root
                    min={0}
                    max={100}
                    step={5}
                    value={[pct]}
                    onValueChange={([value]) =>
                      dispatch(
                        opacitySet({
                          systems: row.systems,
                          opacity: value / 100,
                        }),
                      )
                    }
                    className="relative flex h-4 flex-1 touch-none items-center select-none"
                  >
                    <Slider.Track className="relative h-1 grow rounded-full bg-white/15">
                      <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
                    </Slider.Track>
                    <Slider.Thumb
                      aria-label={`${row.label} opacity`}
                      className="block h-3 w-3 rounded-full bg-white shadow ring-1 ring-slate-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    />
                  </Slider.Root>
                  <span className="w-8 shrink-0 text-right text-[11px] text-slate-300 tabular-nums">
                    {pct}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </section>
  );
}
