import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Slider from '@radix-ui/react-slider';
import { useMemo, useState, type JSX, type KeyboardEvent } from 'react';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { RootState } from '../../app/store';
import { useT } from '../../i18n/t';
import { Chip } from '../../ui/Chip';
import { selectBundlesForSystem } from '../assets/assetsSlice';
import { prefersReducedMotion } from '../motion/reducedMotion';
import { journeyFollowingSet, journeyPlayingSet, journeySpeedSet, type JourneySpeed } from './journeySlice';
import { NutrientsBox } from './NutrientsBox';
import { nutrientsAt } from './nutrients';
import { getRoute, localProgress } from './route';
import type { RealTime } from './schema';
import { exitJourney, nextStage, prevStage, scrubJourney } from './thunks';

const SPEEDS: readonly JourneySpeed[] = [0.5, 1, 2];

function formatRealTime(
  rt: RealTime,
  tr: ReturnType<typeof useT>,
): string {
  if (rt.min === rt.max) {
    if (rt.min === 1) {
      if (rt.unit === 's') return tr('journey.time.sOne');
      if (rt.unit === 'min') return tr('journey.time.minOne');
      return tr('journey.time.hOne');
    }
    if (rt.unit === 's') return tr('journey.time.sSingle', { a: rt.min });
    if (rt.unit === 'min') return tr('journey.time.minSingle', { a: rt.min });
    return tr('journey.time.hSingle', { a: rt.min });
  }
  if (rt.unit === 's') {
    return tr('journey.time.s', { a: rt.min, b: rt.max });
  }
  if (rt.unit === 'min') {
    return tr('journey.time.min', { a: rt.min, b: rt.max });
  }
  return tr('journey.time.h', { a: rt.min, b: rt.max });
}

/** Lazy-loaded bottom card driving the active journey's narration, scrubber, transport, and nutrient bars. */
export function JourneyBar(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const tr = useT();
  const activeId = useAppSelector((s) => s.journey.activeId);
  const loadStatus = useAppSelector((s) => s.journey.loadStatus);
  const defs = useAppSelector((s) => s.journey.defs);
  const texts = useAppSelector((s) => s.journey.texts);
  const centerlines = useAppSelector((s) => s.journey.centerlines);
  const stageIndex = useAppSelector((s) => s.journey.stageIndex);
  const progress = useAppSelector((s) => s.journey.progress);
  const playing = useAppSelector((s) => s.journey.playing);
  const speed = useAppSelector((s) => s.journey.speed);
  const following = useAppSelector((s) => s.journey.following);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const stateBundles = useAppSelector((s) => s.assets.bundles);

  const [mobileBodyOpen, setMobileBodyOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  );

  const reduced = prefersReducedMotion();
  const journey = useMemo(
    () =>
      defs && activeId ? (defs.find((d) => d.id === activeId) ?? null) : null,
    [defs, activeId],
  );

  const route = useMemo(() => {
    if (!journey || !centerlines || !manifest) return null;
    return getRoute(journey, centerlines.lines, manifest.meshes);
  }, [journey, centerlines, manifest]);

  const stageBundleStatus = useMemo<'ready' | 'loading' | 'error'>(() => {
    if (!journey || !manifest) return 'ready';
    const st = journey.stages[stageIndex];
    if (!st) return 'ready';
    const rootState = store.getState();
    let anyLoading = false;
    for (const sys of st.view.s) {
      for (const bId of selectBundlesForSystem(rootState, sys)) {
        const status = stateBundles[bId];
        if (status === 'error') return 'error';
        if (status === 'loading' || status === 'idle') anyLoading = true;
      }
    }
    return anyLoading ? 'loading' : 'ready';
  }, [journey, manifest, stageIndex, store, stateBundles]);

  if (!activeId) return null;

  if (loadStatus === 'error' || stageBundleStatus === 'error') {
    return (
      <section
        role="region"
        aria-label={tr('journey.section')}
        className="pointer-events-auto w-[min(94vw,30rem)] rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-3 text-slate-100 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-red-200">{tr('journey.error')}</span>
          <button
            type="button"
            onClick={() => void dispatch(exitJourney())}
            className="rounded-lg bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            {tr('journey.exit')}
          </button>
        </div>
      </section>
    );
  }

  if (!journey) return null;
  const stage = journey.stages[stageIndex];
  if (!stage) return null;

  const copy = texts?.[journey.id];
  const journeyTitle = copy?.title ?? journey.id;
  const stageText = copy?.stages?.[stage.id];
  const stageTitle = stageText?.title ?? stage.id;
  const stageBody = stageText?.body ?? '';
  const stageNote = stageText?.note;

  const isFirst = stageIndex === 0;
  const isLast = stageIndex + 1 >= journey.stages.length;
  const pct = Math.round(progress * 100);

  const localP = route
    ? localProgress(route, stageIndex, progress)
    : reduced
      ? 0.5
      : 0;
  const liveNutrients = nutrientsAt(journey, stageIndex, localP);

  const handleSliderKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'PageDown') {
      e.preventDefault();
      void dispatch(nextStage());
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      void dispatch(prevStage());
    }
  };

  return (
    <section
      role="region"
      aria-label={journeyTitle}
      className="pointer-events-auto w-[min(94vw,30rem)] rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-3 text-slate-100 shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
    >
      {/* Polite stage announcement on stage change (keyed on stageIndex, never progress) */}
      <div aria-live="polite" className="sr-only">
        {`${stageTitle}. ${stageBody}`}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-300">
        <span className="truncate text-sky-300">{journeyTitle}</span>
        <span className="shrink-0 tabular-nums">
          {tr('journey.progress', {
            i: String(stageIndex + 1),
            n: String(journey.stages.length),
          })}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{stageTitle}</h2>
        <button
          type="button"
          aria-expanded={mobileBodyOpen}
          onClick={() => setMobileBodyOpen((v) => !v)}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400 sm:hidden"
        >
          {mobileBodyOpen ? tr('journey.hideDetails') : tr('journey.showDetails')}
        </button>
      </div>

      {stage.realTime ? (
        <p className="mt-0.5 text-[11px] text-slate-300">
          {tr('journey.realTime', { t: formatRealTime(stage.realTime, tr) })}
        </p>
      ) : null}

      {stageBundleStatus === 'loading' ? (
        <p className="mt-1.5 text-xs text-sky-200">{tr('journey.loading')}</p>
      ) : null}

      {mobileBodyOpen ? (
        <>
          {stageBody ? (
            <p className="mt-1.5 max-h-[20dvh] overflow-y-auto pr-1 text-xs leading-relaxed text-slate-200">
              {stageBody}
            </p>
          ) : null}

          {stageNote ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              >
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
                <path
                  d="M8 7.2v4M8 4.8v.6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>{stageNote}</span>
            </p>
          ) : null}
        </>
      ) : null}

      {!following && !reduced ? (
        <div className="mt-2">
          <Chip onClick={() => dispatch(journeyFollowingSet(true))}>
            {tr('journey.follow')}
          </Chip>
        </div>
      ) : null}

      {/* Scrubber with stage tick markers */}
      <div className="mt-2.5">
        <Slider.Root
          min={0}
          max={1}
          step={0.01}
          value={[progress]}
          aria-label={tr('journey.scrubber')}
          onValueChange={([v]) => {
            if (v !== undefined) void dispatch(scrubJourney(v));
          }}
          onKeyDown={handleSliderKeyDown}
          className="relative flex h-5 w-full touch-none items-center select-none"
        >
          <Slider.Track className="relative h-1.5 grow rounded-full bg-white/15">
            {route
              ? route.stageStart.slice(1).map((tick, idx) => (
                  <span
                    key={journey.stages[idx + 1]?.id ?? idx}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/40"
                    style={{ left: `${tick * 100}%` }}
                  />
                ))
              : null}
            <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
          </Slider.Track>
          <Slider.Thumb
            aria-label={tr('journey.scrubber')}
            aria-valuetext={`${stageTitle}, ${pct}%`}
            className="block h-3.5 w-3.5 rounded-full bg-white shadow ring-2 ring-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          />
        </Slider.Root>
      </div>

      {/* Nutrients */}
      <NutrientsBox nutrients={liveNutrients} />

      {/* Controls */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
        <button
          type="button"
          onClick={() => void dispatch(exitJourney())}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          {tr('journey.exit')}
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          {!reduced ? (
            <>
              <button
                type="button"
                disabled={stageBundleStatus === 'loading'}
                onClick={() => dispatch(journeyPlayingSet(!playing))}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {playing ? tr('journey.pause') : tr('journey.play')}
              </button>

              <RadioGroup.Root
                aria-label={tr('journey.speed')}
                value={String(speed)}
                onValueChange={(v) =>
                  dispatch(journeySpeedSet(Number(v) as JourneySpeed))
                }
                className="flex items-center rounded-lg bg-white/5 p-0.5 ring-1 ring-white/10"
              >
                {SPEEDS.map((sp) => (
                  <RadioGroup.Item
                    key={sp}
                    value={String(sp)}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 ${
                      speed === sp
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {`${sp}×`}
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </>
          ) : null}

          <button
            type="button"
            disabled={isFirst}
            onClick={() => void dispatch(prevStage())}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-100 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
          >
            {tr('journey.back')}
          </button>
          <button
            type="button"
            onClick={() => void dispatch(nextStage())}
            className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            {isLast ? tr('journey.finish') : tr('journey.next')}
          </button>
        </div>
      </div>
    </section>
  );
}
