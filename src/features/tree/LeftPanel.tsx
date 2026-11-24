import * as Tabs from '@radix-ui/react-tabs';
import { lazy, Suspense, useEffect, useRef, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Panel } from '../../ui/Panel';
import { selectToggleRows } from '../systems/selectors';
import { SystemsList } from '../systems/SystemsPanel';
import { TreeView } from './TreeView';

const PinsPanel = lazy(() =>
  import('../pins/PinsPanel').then((m) => ({ default: m.PinsPanel })),
);
const MotionPanel = lazy(() =>
  import('../motion/MotionPanel').then((m) => ({ default: m.MotionPanel })),
);

function startsCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 767px)').matches;
  }
  return window.innerWidth < 768;
}

/** Floating left sidebar hosting Body Systems controls, Browse tree, and lazy Pins/Motion tabs. */
export function LeftPanel(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const rows = useAppSelector(selectToggleRows);
  const focusedPinId = useAppSelector((s) => s.pins.focusedPinId);
  const [collapsed, setCollapsed] = useState(startsCollapsed);
  const [tab, setTab] = useState<'systems' | 'browse' | 'pins' | 'motion'>(
    'systems',
  );
  const [pinsVisited, setPinsVisited] = useState(false);
  const [motionVisited, setMotionVisited] = useState(false);
  const hydratedRef = useRef(false);

  const openPinsTab = () => {
    setPinsVisited(true);
    setTab('pins');
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      void Promise.all([
        import('../pins/storage'),
        import('../pins/pinsSlice'),
      ]).then(([{ loadPins }, { pinsHydrated }]) => {
        dispatch(pinsHydrated(loadPins()));
      });
    }
  };

  useEffect(() => {
    if (!focusedPinId) return;
    queueMicrotask(() => {
      setCollapsed(false);
      openPinsTab();
    });
    // Only react to new focusedPinId requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedPinId]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Body systems and browse"
      className="fixed top-14 left-3 z-10 sm:top-16 sm:left-4"
    >
      <Panel
        side="left"
        label={
          tab === 'systems'
            ? 'Body systems'
            : tab === 'browse'
              ? 'Browse'
              : tab === 'pins'
                ? 'Pins'
                : 'Motion'
        }
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        className={
          collapsed ? '' : 'max-h-[calc(100dvh-9rem)] w-64 overflow-y-auto'
        }
      >
        <Tabs.Root
          value={tab}
          onValueChange={(v) => {
            if (v === 'pins') {
              openPinsTab();
            } else if (v === 'motion') {
              setMotionVisited(true);
              setTab('motion');
            } else {
              setTab(v as 'systems' | 'browse');
            }
          }}
        >
          <Tabs.List
            aria-label="Explorer views"
            className="mb-2.5 grid grid-cols-4 gap-0.5 rounded-lg bg-slate-950/60 p-0.5"
          >
            <Tabs.Trigger
              value="systems"
              className="rounded-md px-1 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=active]:bg-sky-500/30 data-[state=active]:text-white"
            >
              Systems
            </Tabs.Trigger>
            <Tabs.Trigger
              value="browse"
              className="rounded-md px-1 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=active]:bg-sky-500/30 data-[state=active]:text-white"
            >
              Browse
            </Tabs.Trigger>
            <Tabs.Trigger
              value="pins"
              className="rounded-md px-1 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=active]:bg-sky-500/30 data-[state=active]:text-white"
            >
              Pins
            </Tabs.Trigger>
            <Tabs.Trigger
              value="motion"
              className="rounded-md px-1 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=active]:bg-sky-500/30 data-[state=active]:text-white"
            >
              Motion
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content
            value="systems"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <SystemsList />
          </Tabs.Content>
          <Tabs.Content
            value="browse"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <TreeView />
          </Tabs.Content>
          <Tabs.Content value="pins">
            {pinsVisited ? (
              <Suspense fallback={null}>
                <PinsPanel />
              </Suspense>
            ) : null}
          </Tabs.Content>
          <Tabs.Content
            value="motion"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            {motionVisited ? (
              <Suspense fallback={null}>
                <MotionPanel />
              </Suspense>
            ) : null}
          </Tabs.Content>
        </Tabs.Root>
      </Panel>
    </section>
  );
}
