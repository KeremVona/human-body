import { useSyncExternalStore, type JSX } from 'react';
import { useAppSelector } from '../../app/hooks';
import { isMeshId, parseMeshId } from '../../data/ids';
import { pointerPosition } from '../../scene/pointerPosition';
import { selectStructureLookup } from '../content/contentSlice';

/** Pointer-following DOM tooltip showing hovered structure name and anatomical side. */
export function HoverLabel(): JSX.Element | null {
  const hoveredId = useAppSelector((s) => s.selection.hoveredId);
  const lookup = useAppSelector(selectStructureLookup);
  const pos = useSyncExternalStore(
    pointerPosition.subscribe,
    pointerPosition.get,
  );

  const isCoarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  if (!hoveredId || isCoarsePointer || !isMeshId(hoveredId)) {
    return null;
  }

  const { structureId, side } = parseMeshId(hoveredId);
  const entry = lookup.get(structureId);
  if (!entry) {
    return null;
  }

  const label = side ? `${entry.names.common} (${side})` : entry.names.common;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const estWidth = Math.min(260, Math.max(96, label.length * 8 + 24));
  const estHeight = 32;
  const left = Math.max(8, Math.min(pos.x + 12, vw - estWidth - 8));
  const top = Math.max(8, Math.min(pos.y + 16, vh - estHeight - 8));

  return (
    <div
      aria-hidden="true"
      style={{ left: `${left}px`, top: `${top}px` }}
      className="pointer-events-none fixed z-30 rounded-md bg-slate-900/90 px-2.5 py-1 text-xs font-medium text-slate-100 shadow-lg ring-1 ring-white/10 backdrop-blur [@media(pointer:coarse)]:hidden"
    >
      {label}
    </div>
  );
}
