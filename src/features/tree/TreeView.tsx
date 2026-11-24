import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { isMeshId, parseMeshId } from '../../data/ids';
import { hide, unhide } from '../dissection/dissectionSlice';
import { revealAndFocus } from '../search/revealAndFocus';
import {
  ancestorsOf,
  buildTree,
  flattenTree,
  parseTreeTarget,
  type TreeRow,
} from './buildTree';

function EyeIcon({ visible }: { visible: boolean }): JSX.Element {
  return visible ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5"
    >
      <path
        d="M1.5 8s2.3-4.2 6.5-4.2S14.5 8 14.5 8s-2.3 4.2-6.5 4.2S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5"
    >
      <path
        d="M2.5 2.5l11 11M4.3 4.8C2.6 5.9 1.5 8 1.5 8s2.3 4.2 6.5 4.2c1.2 0 2.3-.3 3.2-.9M13.5 9.8C14.1 9 14.5 8 14.5 8s-2.3-4.2-6.5-4.2c-.6 0-1.2.1-1.7.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Virtualised, keyboard-accessible anatomical hierarchy tree (`system > region > group > structure > side`). */
export function TreeView({
  initialExpanded = [],
}: {
  initialExpanded?: string[];
}): JSX.Element | null {
  const dispatch = useAppDispatch();
  const taxonomy = useAppSelector((s) => s.content.taxonomy);
  const index = useAppSelector((s) => s.content.index);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const hidden = useAppSelector((s) => s.dissection.hidden);
  const selectedIds = useAppSelector((s) => s.selection.selectedIds);

  const tree = useMemo(
    () =>
      taxonomy && index && manifest ? buildTree(taxonomy, index, manifest) : [],
    [taxonomy, index, manifest],
  );

  const [manualExpanded, setManualExpanded] = useState<string[]>(() => {
    const initial = new Set(initialExpanded);
    if (selectedIds.length > 0 && taxonomy && index && manifest) {
      const targetKeys = new Set<string>();
      if (selectedIds.length === 1 && isMeshId(selectedIds[0])) {
        const parsed = parseMeshId(selectedIds[0]);
        const entry = index.structures.find((s) => s.id === parsed.structureId);
        targetKeys.add(
          entry?.paired
            ? `mesh:${selectedIds[0]}`
            : `str:${parsed.structureId}`,
        );
      } else {
        for (const id of selectedIds) {
          if (isMeshId(id))
            targetKeys.add(`str:${parseMeshId(id).structureId}`);
        }
      }
      for (const targetKey of targetKeys) {
        for (const anc of ancestorsOf(targetKey, tree)) {
          initial.add(anc);
        }
      }
    }
    return [...initial];
  });
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [errorSystem, setErrorSystem] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusKeyRef = useRef<string | null>(null);

  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      if (isMeshId(id)) {
        const parsed = parseMeshId(id);
        const entry = index?.structures.find(
          (s) => s.id === parsed.structureId,
        );
        if (entry?.paired) {
          keys.add(`mesh:${id}`);
        } else {
          keys.add(`str:${parsed.structureId}`);
        }
      }
    } else if (selectedIds.length > 1) {
      for (const id of selectedIds) {
        if (isMeshId(id)) {
          keys.add(`str:${parseMeshId(id).structureId}`);
        }
      }
    }
    return keys;
  }, [selectedIds, index]);

  useEffect(() => {
    if (selectedKeys.size === 0) return;
    setManualExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const targetKey of selectedKeys) {
        for (const anc of ancestorsOf(targetKey, tree)) {
          if (!next.has(anc)) {
            next.add(anc);
            changed = true;
          }
        }
      }
      return changed ? [...next] : prev;
    });
  }, [selectedKeys, tree]);

  const expandedSet = useMemo(() => new Set(manualExpanded), [manualExpanded]);

  const systemLabels = useMemo(
    () => new Map((taxonomy?.systems ?? []).map((s) => [s.id, s.label])),
    [taxonomy],
  );
  const structureSystems = useMemo(
    () => new Map((index?.structures ?? []).map((s) => [s.id, s.system])),
    [index],
  );

  const rows = useMemo(
    () => flattenTree(tree, expandedSet),
    [tree, expandedSet],
  );

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 6,
    initialRect: { width: 240, height: 320 },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const target = pendingFocusKeyRef.current;
    if (!target) return;
    const el = itemRefs.current.get(target);
    if (el) {
      pendingFocusKeyRef.current = null;
      el.focus();
    }
  }, [virtualItems, rows]);

  if (rows.length === 0) {
    return null;
  }

  const activeKey =
    focusedKey && rows.some((r) => r.key === focusedKey)
      ? focusedKey
      : rows[0].key;

  const focusRowAt = (indexToFocus: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, indexToFocus));
    const targetRow = rows[clamped];
    if (!targetRow) return;
    setFocusedKey(targetRow.key);
    pendingFocusKeyRef.current = targetRow.key;
    rowVirtualizer.scrollToIndex(clamped, { align: 'auto' });
    const immediate = itemRefs.current.get(targetRow.key);
    if (immediate) {
      pendingFocusKeyRef.current = null;
      immediate.focus();
    }
  };

  const toggleExpand = (key: string, nextOpen?: boolean) => {
    setManualExpanded((prev) => {
      const has = prev.includes(key);
      const open = nextOpen ?? !has;
      if (open && !has) return [...prev, key];
      if (!open && has) return prev.filter((k) => k !== key);
      return prev;
    });
  };

  const activateRow = async (row: TreeRow) => {
    const target = parseTreeTarget(row.key);
    if (target) {
      setErrorSystem(null);
      try {
        await dispatch(revealAndFocus(target.structureId, target.side));
      } catch {
        const sysId = structureSystems.get(target.structureId);
        const label = sysId ? (systemLabels.get(sysId) ?? sysId) : 'requested';
        setErrorSystem(label);
      }
      return;
    }
    if (row.hasChildren) {
      toggleExpand(row.key, !row.expanded);
    }
  };

  const handleRowKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    row: TreeRow,
    rowIndex: number,
  ) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRowAt(rowIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRowAt(rowIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusRowAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusRowAt(rows.length - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (row.hasChildren) {
          if (!row.expanded) {
            toggleExpand(row.key, true);
          } else if (rowIndex + 1 < rows.length) {
            focusRowAt(rowIndex + 1);
          }
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (row.hasChildren && row.expanded) {
          toggleExpand(row.key, false);
        } else {
          const parentKey = ancestorsOf(row.key, tree).at(-1);
          if (parentKey) {
            const pIdx = rows.findIndex((r) => r.key === parentKey);
            if (pIdx >= 0) focusRowAt(pIdx);
          }
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        void activateRow(row);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {errorSystem ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-md bg-red-950/90 px-2.5 py-1.5 text-xs text-red-100 ring-1 ring-red-500/40"
        >
          <span>Couldn&apos;t load the {errorSystem} model.</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorSystem(null)}
            className="shrink-0 rounded px-1 text-red-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            ×
          </button>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="h-[min(18rem,calc(100dvh-15rem))] overflow-y-auto pr-1"
      >
        <div
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          className="relative flex w-full"
        >
          <div
            role="tree"
            aria-label="Anatomy hierarchy"
            className="relative min-w-0 flex-1"
          >
            {virtualItems.map((vItem) => {
              const row = rows[vItem.index];
              if (!row) return null;
              const isSelected = selectedKeys.has(row.key);
              const isTabbable = row.key === activeKey;

              return (
                <div
                  key={row.key}
                  ref={(el) => {
                    if (el) itemRefs.current.set(row.key, el);
                    else itemRefs.current.delete(row.key);
                  }}
                  role="treeitem"
                  aria-level={row.depth + 1}
                  aria-expanded={row.hasChildren ? row.expanded : undefined}
                  aria-selected={isSelected}
                  aria-label={row.label}
                  tabIndex={isTabbable ? 0 : -1}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${vItem.size}px`,
                    transform: `translateY(${vItem.start}px)`,
                    paddingLeft: `${row.depth * 12 + 4}px`,
                  }}
                  onFocus={() => setFocusedKey(row.key)}
                  onClick={() => void activateRow(row)}
                  onKeyDown={(e) => handleRowKeyDown(e, row, vItem.index)}
                  className={`flex cursor-pointer items-center gap-1 rounded px-1 text-xs transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-400 ${
                    isSelected
                      ? 'bg-sky-500/25 text-white'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {row.hasChildren ? (
                    <span
                      aria-hidden="true"
                      className="inline-block w-3 shrink-0 text-center text-[10px] text-slate-400"
                    >
                      {row.expanded ? '▾' : '▸'}
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-block w-3 shrink-0"
                    />
                  )}
                  <span className="truncate">{row.label}</span>
                </div>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Visibility toggles"
            className="relative w-7 shrink-0"
          >
            {virtualItems.map((vItem) => {
              const row = rows[vItem.index];
              if (!row) return null;
              const anyHidden = row.meshIds.some((id) => hiddenSet.has(id));
              return (
                <button
                  key={row.key}
                  type="button"
                  aria-label={
                    anyHidden ? `Show ${row.label}` : `Hide ${row.label}`
                  }
                  title={anyHidden ? `Show ${row.label}` : `Hide ${row.label}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: `${vItem.size}px`,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                  onClick={() => {
                    if (anyHidden) {
                      dispatch(unhide(row.meshIds));
                    } else {
                      dispatch(hide(row.meshIds));
                    }
                  }}
                  className={`inline-flex w-7 items-center justify-center rounded transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    anyHidden ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  <EyeIcon visible={!anyHidden} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
