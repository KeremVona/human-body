import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Slider from '@radix-ui/react-slider';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { getActiveLocale, useT, type MessageKey } from '../../i18n/t';
import { motionPhase } from './motionPhase';
import {
  motionPaused,
  motionPlayed,
  motionScrubbed,
  motionSpeedSet,
} from './motionSlice';
import { prefersReducedMotion } from './reducedMotion';
import { loadMotions, startMotion, stopMotion } from './thunks';

const SPEEDS: readonly { value: '0.5' | '1'; label: string }[] = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
];

/** Lazy-loaded Motion tab panel listing anatomical motion demos and playback controls. */
export function MotionPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const tr = useT();
  const locale = getActiveLocale();
  const { defs, loadStatus, activeId, owner, playing, speed, scrubPhase } =
    useAppSelector((s) => s.motion);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');
  const journeyActive = useAppSelector((s) => s.journey.activeId !== null);
  const userActiveId = owner === 'journey' ? null : activeId;
  const speedHeadingId = useId();
  const livePhase = useSyncExternalStore(
    motionPhase.subscribe,
    motionPhase.get,
    motionPhase.get,
  );
  const [stoppedAnnouncement, setStoppedAnnouncement] = useState(false);
  const prevActiveIdRef = useRef<string | null>(userActiveId);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (loadStatus === 'idle') {
      void dispatch(loadMotions());
    }
  }, [dispatch, loadStatus]);

  useEffect(() => {
    const prev = prevActiveIdRef.current;
    prevActiveIdRef.current = userActiveId;
    if (prev !== null && userActiveId === null) {
      queueMicrotask(() => setStoppedAnnouncement(true));
    } else if (userActiveId !== null) {
      queueMicrotask(() => setStoppedAnnouncement(false));
    }
  }, [userActiveId]);

  const activeDef = defs?.find((d) => d.id === userActiveId);
  const displayPhase = playing ? livePhase : scrubPhase;
  const pct = Math.round(displayPhase * 100);

  let statusMessage = '';
  if (activeDef) {
    const activeLabel =
      locale === 'en'
        ? activeDef.label
        : tr(`motion.demos.${activeDef.id}` as MessageKey);
    statusMessage = playing
      ? tr('motion.playing', { label: activeLabel })
      : tr('motion.paused');
  } else if (stoppedAnnouncement) {
    statusMessage = tr('motion.stopped');
  }

  const sliderBlock = (
    <div key="slider" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{tr('motion.position')}</span>
        <span className="text-slate-200 tabular-nums">{pct}%</span>
      </div>
      <Slider.Root
        min={0}
        max={1}
        step={0.01}
        value={[displayPhase]}
        onValueChange={([val]) => {
          if (val === undefined) return;
          motionPhase.set(val);
          if (playing) {
            dispatch(motionPaused(val));
          } else {
            dispatch(motionScrubbed(val));
          }
        }}
        className="relative flex h-4 w-full touch-none items-center select-none"
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-white/15">
          <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={tr('motion.position')}
          className="block h-3.5 w-3.5 rounded-full bg-white shadow ring-1 ring-slate-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        />
      </Slider.Root>
    </div>
  );

  const transportBlock = (
    <div key="transport" className="grid grid-cols-2 gap-1.5">
      <button
        type="button"
        onClick={() => {
          if (playing) {
            dispatch(motionPaused(motionPhase.get()));
          } else {
            dispatch(motionPlayed());
          }
        }}
        className="rounded-lg bg-sky-500/25 px-2.5 py-1.5 font-medium text-white hover:bg-sky-500/35 focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        {playing ? tr('motion.pause') : tr('motion.play')}
      </button>
      <button
        type="button"
        onClick={() => {
          setStoppedAnnouncement(true);
          dispatch(stopMotion());
        }}
        className="rounded-lg bg-white/10 px-2.5 py-1.5 font-medium text-slate-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        {tr('motion.stop')}
      </button>
    </div>
  );

  const speedBlock = (
    <div key="speed" className="flex items-center justify-between gap-2">
      <span
        id={speedHeadingId}
        className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase"
      >
        {tr('motion.speed')}
      </span>
      <RadioGroup.Root
        aria-labelledby={speedHeadingId}
        value={String(speed)}
        onValueChange={(val) => {
          if (val === '0.5' || val === '1') {
            dispatch(motionSpeedSet(val === '0.5' ? 0.5 : 1));
          }
        }}
        className="grid grid-cols-2 gap-1"
      >
        {SPEEDS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-medium hover:bg-white/10"
          >
            <RadioGroup.Item
              value={option.value}
              aria-label={
                option.value === '0.5'
                  ? tr('motion.halfSpeed')
                  : tr('motion.normalSpeed')
              }
              className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-slate-400 bg-slate-950 focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=checked]:border-sky-400"
            >
              <RadioGroup.Indicator className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            </RadioGroup.Item>
            <span>
              {option.value === '0.5'
                ? tr('motion.halfSpeed')
                : tr('motion.normalSpeed')}
            </span>
          </label>
        ))}
      </RadioGroup.Root>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 text-xs text-slate-200">
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      {loadStatus === 'loading' && !defs ? (
        <p className="text-slate-400">{tr('motion.loading')}</p>
      ) : null}

      {loadStatus === 'error' ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-950/40 px-2.5 py-2 text-amber-200">
          <span>{tr('motion.error')}</span>
          <button
            type="button"
            onClick={() => void dispatch(loadMotions())}
            className="rounded bg-white/10 px-2 py-1 font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {tr('motion.retry')}
          </button>
        </div>
      ) : null}

      {defs && defs.length > 0 ? (
        <ul
          className="flex flex-col gap-1.5"
          aria-label={tr('motion.demosAria')}
        >
          {defs.map((def) => {
            const isActive = userActiveId === def.id;
            const label =
              locale === 'en'
                ? def.label
                : tr(`motion.demos.${def.id}` as MessageKey);
            return (
              <li key={def.id}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  disabled={quizActive || journeyActive}
                  title={
                    quizActive
                      ? tr('motion.finishQuizTitle')
                      : journeyActive
                        ? tr('journey.finishFirst')
                        : undefined
                  }
                  onClick={() => {
                    setStoppedAnnouncement(false);
                    void dispatch(startMotion(def.id));
                  }}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-45 ${
                    isActive
                      ? 'border-sky-400/60 bg-sky-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {activeDef ? (
        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/50 p-2.5">
          {reducedMotion
            ? [sliderBlock, transportBlock, speedBlock]
            : [transportBlock, speedBlock, sliderBlock]}
        </div>
      ) : null}

      <p className="text-[11px] leading-snug text-slate-400">
        {tr('motion.caption')}
      </p>
    </div>
  );
}
