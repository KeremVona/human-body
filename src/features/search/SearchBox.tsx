import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { getActiveLocale, useT, type MessageKey } from '../../i18n/t';
import { revealAndFocus } from './revealAndFocus';
import { buildSearchIndex, type SearchHit } from './searchIndex';

/** Top-bar autocomplete combobox searching anatomy names, Latin terms, and lay synonyms. */
export function SearchBox(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const tr = useT();
  const locale = getActiveLocale();
  const index = useAppSelector((s) => s.content.index);
  const enIndex = useAppSelector((s) => s.content.enIndex);
  const taxonomy = useAppSelector((s) => s.content.taxonomy);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [errorSystem, setErrorSystem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionPrefix = useId();

  const searchEngine = useMemo(
    () =>
      index ? buildSearchIndex(index, locale !== 'en' ? enIndex : null) : null,
    [index, enIndex, locale],
  );

  const systemMeta = useMemo(
    () => new Map((taxonomy?.systems ?? []).map((s) => [s.id, s])),
    [taxonomy],
  );

  const trimmed = query.trim();
  const hits = useMemo(
    () => (searchEngine && trimmed ? searchEngine.search(trimmed) : []),
    [searchEngine, trimmed],
  );

  const showList = open && trimmed.length > 0;
  const clampedActive =
    hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : -1;

  const pickHit = useCallback(
    async (hit: SearchHit) => {
      setOpen(false);
      setQuery('');
      setActiveIndex(0);
      setErrorSystem(null);
      try {
        await dispatch(revealAndFocus(hit.structureId, 'both'));
      } catch {
        const label =
          locale === 'en'
            ? (systemMeta.get(hit.system)?.label ?? hit.system)
            : tr(`systems.names.${hit.system}` as MessageKey);
        setErrorSystem(label);
      }
    },
    [dispatch, locale, systemMeta, tr],
  );

  if (!index) {
    return null;
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setOpen(false);
      setActiveIndex(0);
      setErrorSystem(null);
      return;
    }

    if (!showList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (trimmed.length > 0) setOpen(true);
      return;
    }

    if (hits.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[clampedActive >= 0 ? clampedActive : 0];
      if (hit) void pickHit(hit);
    }
  };

  return (
    <div className="pointer-events-auto relative mx-auto w-full max-w-sm">
      <div className="relative flex items-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400"
        >
          <circle
            cx="9"
            cy="9"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M13.5 13.5L17 17"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={tr('search.ariaLabel')}
          aria-expanded={showList}
          aria-controls={showList ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && clampedActive >= 0
              ? `${optionPrefix}-${hits[clampedActive].structureId}`
              : undefined
          }
          placeholder={tr('search.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
            setErrorSystem(null);
          }}
          onFocus={() => {
            if (trimmed.length > 0) setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onKeyDown={handleKeyDown}
          className="h-9 w-full rounded-xl border border-white/10 bg-slate-900/80 pr-3 pl-8 text-xs text-slate-100 placeholder-slate-400 shadow-lg backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        />
      </div>

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={tr('search.resultsAria')}
          className="absolute inset-x-0 top-10 z-30 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 p-1 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
        >
          {hits.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              className="px-3 py-2 text-slate-400"
            >
              {tr('search.noMatches')}
            </li>
          ) : (
            hits.map((hit, idx) => {
              const active = idx === clampedActive;
              const sys = systemMeta.get(hit.system);
              const sysLabel =
                locale === 'en'
                  ? (sys?.label ?? hit.system)
                  : tr(`systems.names.${hit.system}` as MessageKey);
              return (
                <li
                  key={hit.structureId}
                  id={`${optionPrefix}-${hit.structureId}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    void pickHit(hit);
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${
                    active ? 'bg-sky-500/25 text-white' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">
                      {hit.common}
                    </div>
                    {hit.latin ? (
                      <div className="truncate text-[11px] text-slate-300 italic">
                        {hit.latin}
                      </div>
                    ) : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: sys?.color ?? '#94A3B8' }}
                    />
                    {sysLabel}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {errorSystem ? (
        <p
          role="alert"
          className="mt-1.5 rounded-lg bg-red-950/90 px-3 py-1.5 text-xs text-red-100 shadow-lg ring-1 ring-red-500/40 backdrop-blur"
        >
          {tr('search.errorPrefix', { system: errorSystem })}
        </p>
      ) : null}
    </div>
  );
}
