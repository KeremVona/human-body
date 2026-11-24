import {
  lazy,
  Suspense,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
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

const PRESETS: readonly { preset: Preset; label: string; short: string }[] = [
  { preset: 'anterior', label: 'Anterior view', short: 'Ant' },
  { preset: 'posterior', label: 'Posterior view', short: 'Post' },
  { preset: 'left', label: 'Left lateral view', short: 'L' },
  { preset: 'right', label: 'Right lateral view', short: 'R' },
  { preset: 'superior', label: 'Superior view', short: 'Sup' },
  { preset: 'inferior', label: 'Inferior view', short: 'Inf' },
];

const btnClass =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:pointer-events-none disabled:opacity-40';

/** Bottom-centre toolbar with anatomical view presets, reset, undo, and show all. */
export function Toolbar(): JSX.Element {
  const dispatch = useAppDispatch();
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
        aria-label="Viewer controls"
        onKeyDown={handleKeyDown}
        className="fixed bottom-3 left-1/2 z-10 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/70 p-1 text-slate-100 shadow-xl backdrop-blur-md [scrollbar-width:none]"
      >
        {PRESETS.map((item) => (
          <button
            key={item.preset}
            type="button"
            title={item.label}
            onClick={() => void cameraApi.goToPreset(item.preset)}
            className={btnClass}
          >
            <span aria-hidden="true">{item.short}</span>
            <span className="sr-only">{item.label}</span>
          </button>
        ))}

        <div
          aria-hidden="true"
          className="mx-0.5 h-5 w-px shrink-0 bg-white/15"
        />

        <button
          type="button"
          aria-label="Reset view"
          title="Reset view"
          onClick={() => void cameraApi.resetView()}
          className={btnClass}
        >
          Reset
        </button>

        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo || quizActive}
          onClick={() => dispatch(undo())}
          className={btnClass}
        >
          Undo
        </button>

        <button
          type="button"
          aria-label="Show all"
          title="Show all"
          disabled={!hasDissection || quizActive}
          onClick={() => dispatch(showAll())}
          className={btnClass}
        >
          Show all
        </button>

        <div
          aria-hidden="true"
          className="mx-0.5 h-5 w-px shrink-0 bg-white/15"
        />

        <button
          ref={sectionButtonRef}
          type="button"
          title="Cross-section"
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
          Cross-section
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
