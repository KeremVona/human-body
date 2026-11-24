import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { parseMeshId } from '../../data/ids';
import { useT } from '../../i18n/t';
import { useCameraApi } from '../../scene/camera';
import { useMeshRegistry } from '../../scene/meshRegistry';
import { selectStructureLookup } from '../content/contentSlice';
import { localToWorld } from './pinProjection';
import {
  editorOpened,
  focusPinCleared,
  pinDeleted,
  pinDeleteUndone,
  sharedPinsSaved,
} from './pinsSlice';

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/** Pins list panel with newest-first ordering, Go to, Edit, Delete/Undo, and Save shared pins. */
export function PinsPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const tr = useT();
  const cameraApi = useCameraApi();
  const registry = useMeshRegistry();
  const items = useAppSelector((s) => s.pins.items);
  const lastDeleted = useAppSelector((s) => s.pins.lastDeleted);
  const focusedPinId = useAppSelector((s) => s.pins.focusedPinId);
  const lookup = useAppSelector(selectStructureLookup);

  const [showUndo, setShowUndo] = useState(false);
  const undoTimerRef = useRef<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const sortedPins = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items],
  );
  const hasShared = useMemo(
    () => items.some((p) => p.shared === true),
    [items],
  );

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!focusedPinId) return;
    const row = rowRefs.current.get(focusedPinId);
    if (row) {
      row.scrollIntoView?.({ block: 'nearest' });
      const goBtn = row.querySelector('button');
      goBtn?.focus();
    }
    dispatch(focusPinCleared());
  }, [focusedPinId, sortedPins.length, dispatch]);

  const handleDelete = (id: string) => {
    dispatch(pinDeleted(id));
    setShowUndo(true);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setShowUndo(false);
      undoTimerRef.current = null;
    }, 5000);
  };

  return (
    <div className="flex flex-col gap-2 text-xs text-slate-200">
      {hasShared ? (
        <button
          type="button"
          onClick={() => dispatch(sharedPinsSaved())}
          className="w-full rounded-lg bg-sky-700 px-2.5 py-1.5 font-medium text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-sky-300"
        >
          {tr('pins.saveShared')}
        </button>
      ) : null}

      {showUndo && lastDeleted ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5"
        >
          <span>{tr('pins.deleted')}</span>
          <button
            type="button"
            onClick={() => {
              dispatch(pinDeleteUndone());
              setShowUndo(false);
              if (undoTimerRef.current !== null) {
                window.clearTimeout(undoTimerRef.current);
                undoTimerRef.current = null;
              }
            }}
            className="rounded px-1.5 py-0.5 font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {tr('pins.undo')}
          </button>
        </div>
      ) : null}

      {sortedPins.length === 0 ? (
        <p className="py-3 text-slate-400">
          {isCoarsePointer() ? tr('pins.emptyTouch') : tr('pins.emptyMouse')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedPins.map((pin) => {
            const entry = lookup.get(parseMeshId(pin.meshId).structureId);
            const partName = entry?.names.common ?? pin.meshId;
            return (
              <li
                key={pin.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(pin.id, el);
                  else rowRefs.current.delete(pin.id);
                }}
                className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-slate-950/50 p-2"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="min-w-0 font-semibold break-words text-white">
                    {pin.label}
                  </span>
                  {pin.shared ? (
                    <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                      {tr('pins.sharedBadge')}
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] text-slate-400">{partName}</span>
                {pin.note ? (
                  <p className="break-words whitespace-pre-wrap text-slate-300">
                    {pin.note}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const mesh = registry.get(pin.meshId);
                      const world = mesh
                        ? localToWorld(mesh, pin.local)
                        : pin.local;
                      void cameraApi.lookAtPoint(world);
                    }}
                    className="rounded bg-white/10 px-2 py-0.5 font-medium text-slate-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    {tr('pins.goTo')}
                  </button>
                  {!pin.shared ? (
                    <button
                      type="button"
                      onClick={() => dispatch(editorOpened(pin.id))}
                      className="rounded bg-white/10 px-2 py-0.5 font-medium text-slate-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
                    >
                      {tr('pins.edit')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(pin.id)}
                    className="rounded bg-white/10 px-2 py-0.5 font-medium text-red-200 hover:bg-red-900/50 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    {tr('pins.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
