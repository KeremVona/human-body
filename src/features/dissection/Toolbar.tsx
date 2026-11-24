import {
  lazy,
  Suspense,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useT, type MessageKey } from '../../i18n/t';
import { useCameraApi, type Preset } from '../../scene/camera';
import {
  selectCanUndo,
  selectHasDissection,
  showAll,
  undo,
} from './dissectionSlice';

const SectionPopover = lazy(() =>
  import('../section/SectionPopover').then((m) => ({
    default: m.SectionPopover,
  })),
);

const PRESETS: readonly {
  preset: Preset;
  labelKey: MessageKey;
  shortKey: MessageKey;
}[] = [
  {
    preset: 'anterior',
    labelKey: 'toolbar.anteriorLabel',
    shortKey: 'toolbar.anteriorShort',
  },
  {
    preset: 'posterior',
    labelKey: 'toolbar.posteriorLabel',
    shortKey: 'toolbar.posteriorShort',
  },
  {
    preset: 'left',
    labelKey: 'toolbar.leftLabel',
    shortKey: 'toolbar.leftShort',
  },
  {
    preset: 'right',
    labelKey: 'toolbar.rightLabel',
    shortKey: 'toolbar.rightShort',
  },
  {
    preset: 'superior',
    labelKey: 'toolbar.superiorLabel',
    shortKey: 'toolbar.superiorShort',
  },
  {
    preset: 'inferior',
    labelKey: 'toolbar.inferiorLabel',
    shortKey: 'toolbar.inferiorShort',
  },
];

const btnClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:pointer-events-none disabled:opacity-40 sm:px-2.5 sm:text-xs';

/** Bottom-centre toolbar with anatomical view presets, reset, undo, and show all. */
export function Toolbar(): JSX.Element {
  const dispatch = useAppDispatch();
  const tr = useT();
  const cameraApi = useCameraApi();
  const canUndo = useAppSelector(selectCanUndo);
  const hasDissection = useAppSelector(selectHasDissection);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');
  const sectionEnabled = useAppSelector((s) => s.section.enabled);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionLoaded, setSectionLoaded] = useState(false);
  const sectionButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) {
      return;
    }
    if (
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    ) {
      return;
    }
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      ),
    );
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex: number;
    if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = buttons.length - 1;
    } else {
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + delta + buttons.length) % buttons.length;
    }
    e.preventDefault();
    buttons[nextIndex]?.focus();
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label={tr('toolbar.ariaLabel')}
        onKeyDown={handleKeyDown}
        className="fixed bottom-3 left-1/2 z-10 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/70 p-1 text-slate-100 shadow-xl backdrop-blur-md [scrollbar-width:none] sm:max-w-[calc(100vw-1.5rem)] sm:gap-1"
      >
        {PRESETS.map((item) => {
          const label = tr(item.labelKey);
          return (
            <button
              key={item.preset}
              type="button"
              title={label}
              onClick={() => void cameraApi.goToPreset(item.preset)}
              className={btnClass}
            >
              <span aria-hidden="true">{tr(item.shortKey)}</span>
              <span className="sr-only">{label}</span>
            </button>
          );
        })}

        <div
          aria-hidden="true"
          className="mx-0.5 h-5 w-px shrink-0 bg-white/15"
        />

        <button
          type="button"
          aria-label={tr('toolbar.resetLabel')}
          title={tr('toolbar.resetLabel')}
          onClick={() => void cameraApi.resetView()}
          className={btnClass}
        >
          {tr('toolbar.resetShort')}
        </button>

        <button
          type="button"
          aria-label={tr('toolbar.undo')}
          title={tr('toolbar.undo')}
          disabled={!canUndo || quizActive}
          onClick={() => dispatch(undo())}
          className={btnClass}
        >
          {tr('toolbar.undo')}
        </button>

        <button
          type="button"
          aria-label={tr('toolbar.showAll')}
          title={tr('toolbar.showAll')}
          disabled={!hasDissection || quizActive}
          onClick={() => dispatch(showAll())}
          className={btnClass}
        >
          {tr('toolbar.showAll')}
        </button>

        <div
          aria-hidden="true"
          className="mx-0.5 h-5 w-px shrink-0 bg-white/15"
        />

        <button
          ref={sectionButtonRef}
          type="button"
          title={tr('toolbar.crossSection')}
          aria-pressed={sectionEnabled}
          aria-expanded={sectionOpen}
          aria-haspopup="dialog"
          disabled={quizActive}
          onClick={() => {
            setSectionLoaded(true);
            setSectionOpen((o) => !o);
          }}
          className={`${btnClass} ${sectionEnabled ? 'bg-sky-600/35 text-sky-200 ring-1 ring-sky-400/50' : ''}`}
        >
          {tr('toolbar.crossSection')}
        </button>
      </div>

      {sectionLoaded && !quizActive ? (
        <Suspense fallback={null}>
          <SectionPopover
            open={sectionOpen}
            onOpenChange={setSectionOpen}
            triggerRef={sectionButtonRef}
          />
        </Suspense>
      ) : null}
    </>
  );
}
