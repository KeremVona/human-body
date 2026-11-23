import * as Tabs from '@radix-ui/react-tabs';
import { useState, type JSX } from 'react';
import { useAppSelector } from '../../app/hooks';
import { Panel } from '../../ui/Panel';
import { selectToggleRows } from '../systems/selectors';
import { SystemsList } from '../systems/SystemsPanel';
import { TreeView } from './TreeView';

function startsCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 767px)').matches;
  }
  return window.innerWidth < 768;
}

/** Floating left sidebar hosting Body Systems controls and the Browse anatomy hierarchy tree. */
export function LeftPanel(): JSX.Element | null {
  const rows = useAppSelector(selectToggleRows);
  const [collapsed, setCollapsed] = useState(startsCollapsed);
  const [tab, setTab] = useState<'systems' | 'browse'>('systems');

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
        label={tab === 'systems' ? 'Body systems' : 'Browse'}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        className={
          collapsed ? '' : 'max-h-[calc(100dvh-9rem)] w-64 overflow-y-auto'
        }
      >
        <Tabs.Root
          value={tab}
          onValueChange={(v) => setTab(v as 'systems' | 'browse')}
        >
          <Tabs.List
            aria-label="Explorer views"
            className="mb-2.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-950/60 p-0.5"
          >
            <Tabs.Trigger
              value="systems"
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=active]:bg-sky-500/30 data-[state=active]:text-white"
            >
              Systems
            </Tabs.Trigger>
            <Tabs.Trigger
              value="browse"
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=active]:bg-sky-500/30 data-[state=active]:text-white"
            >
              Browse
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="systems">
            <SystemsList />
          </Tabs.Content>
          <Tabs.Content value="browse">
            <TreeView />
          </Tabs.Content>
        </Tabs.Root>
      </Panel>
    </section>
  );
}
