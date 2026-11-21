import { useEffect, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toMeshId } from '../../data/ids';
import type { Details } from '../../data/schema';
import { useCameraApi } from '../../scene/camera';
import { Chip } from '../../ui/Chip';
import { IconButton } from '../../ui/IconButton';
import { selectStructureLookup } from '../content/contentSlice';
import { fadeOthers, hide, isolate } from '../dissection/dissectionSlice';
import { selected, selectionCleared } from '../selection/selectionSlice';
import { selectInspectorModel } from './selectors';

function isNarrowScreen(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(max-width: 767px)').matches;
  }
  return window.innerWidth < 768;
}

function useInspectorLayout(): 'drawer' | 'sheet' {
  const [narrow, setNarrow] = useState(isNarrowScreen);

  useEffect(() => {
    const update = () => setNarrow(isNarrowScreen());
    update();
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)')
        : null;
    mq?.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq?.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return narrow ? 'sheet' : 'drawer';
}

function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function DetailsSection({ details }: { details: Details }): JSX.Element {
  const lookup = useAppSelector(selectStructureLookup);

  if (details.kind === 'muscle') {
    const rows = [
      ['Origin', details.origin],
      ['Insertion', details.insertion],
      ['Innervation', details.innervation],
      ['Blood supply', details.bloodSupply],
      ['Primary action', details.action],
    ] as const;

    return (
      <dl className="space-y-2 rounded-lg bg-white/5 p-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold text-slate-300">{label}</dt>
            <dd className="text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (details.kind === 'bone') {
    const articulatesNames = details.articulatesWith.map(
      (id) => lookup.get(id)?.names.common ?? id,
    );
    return (
      <dl className="space-y-2 rounded-lg bg-white/5 p-3 text-xs">
        <div>
          <dt className="font-semibold text-slate-300">Type</dt>
          <dd className="capitalize text-slate-100">{details.boneType}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-300">Articulates with</dt>
          <dd className="text-slate-100">
            {articulatesNames.length > 0 ? articulatesNames.join(', ') : '—'}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-xs text-slate-200">
      {details.facts.map((fact) => (
        <li key={fact}>{fact}</li>
      ))}
    </ul>
  );
}

/** Structure details panel rendered as a right drawer (>=768px) or bottom sheet (<768px). */
export function Inspector(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const cameraApi = useCameraApi();
  const model = useAppSelector(selectInspectorModel);
  const layout = useInspectorLayout();

  if (!model) {
    return null;
  }

  const sideBadgeLabel =
    model.side === 'Left'
      ? 'Left side'
      : model.side === 'Right'
        ? 'Right side'
        : model.side === 'Both'
          ? 'Both sides'
          : null;

  const containerClass =
    layout === 'sheet'
      ? 'fixed inset-x-0 bottom-0 z-30 flex max-h-[55dvh] flex-col rounded-t-2xl border-t border-white/10 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md'
      : 'fixed top-3 right-3 bottom-16 z-20 flex w-80 flex-col rounded-xl border border-white/10 bg-slate-900/75 text-slate-100 shadow-2xl backdrop-blur-md sm:top-4 sm:right-4';

  const breadcrumb = [model.systemLabel, model.regionLabel, model.groupLabel]
    .filter(Boolean)
    .join(' › ');

  return (
    <aside
      aria-label="Structure details"
      data-layout={layout}
      className={containerClass}
    >
      <div className="shrink-0 border-b border-white/10 p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">
              {model.common}
            </h2>
            {model.latin ? (
              <p className="text-xs text-slate-300 italic">{model.latin}</p>
            ) : null}
          </div>
          <IconButton
            label="Close details"
            onClick={() => dispatch(selectionCleared())}
            className="h-7 w-7"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip swatchColor={model.systemColor}>{model.systemLabel}</Chip>
          {sideBadgeLabel ? <Chip>{sideBadgeLabel}</Chip> : null}
        </div>

        <p className="mt-2 text-xs text-slate-400">{breadcrumb}</p>

        {model.paired ? (
          <div
            className="mt-2.5 flex items-center gap-1.5"
            role="group"
            aria-label="Side selector"
          >
            <Chip
              active={model.side === 'Left'}
              onClick={() =>
                dispatch(selected([toMeshId(model.structureId, 'left')]))
              }
            >
              Left
            </Chip>
            <Chip
              active={model.side === 'Right'}
              onClick={() =>
                dispatch(selected([toMeshId(model.structureId, 'right')]))
              }
            >
              Right
            </Chip>
            <Chip
              active={model.side === 'Both'}
              onClick={() =>
                dispatch(
                  selected([
                    toMeshId(model.structureId, 'left'),
                    toMeshId(model.structureId, 'right'),
                  ]),
                )
              }
            >
              Both
            </Chip>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void cameraApi.focusMeshes(model.meshIds)}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Focus
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch(isolate(model.meshIds));
              void cameraApi.focusMeshes(model.meshIds);
            }}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Isolate
          </button>
          <button
            type="button"
            onClick={() => dispatch(hide(model.meshIds))}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Hide
          </button>
          <button
            type="button"
            onClick={() => dispatch(fadeOthers(model.meshIds))}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Fade others
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {model.contentStatus === 'loading' ? (
          <div
            aria-label="Loading structure details"
            className="space-y-2 animate-pulse motion-reduce:animate-none"
          >
            <div className="h-3 w-3/4 rounded bg-slate-700/60" />
            <div className="h-3 w-full rounded bg-slate-700/60" />
            <div className="h-3 w-5/6 rounded bg-slate-700/60" />
          </div>
        ) : (
          <>
            <section className="space-y-1">
              <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                Overview
              </h3>
              <p className="text-slate-100">
                {model.overview ?? 'Description coming soon.'}
              </p>
            </section>

            {model.function ? (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  Function
                </h3>
                <p className="text-slate-100">{model.function}</p>
              </section>
            ) : null}

            {model.details ? (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  Details
                </h3>
                <DetailsSection details={model.details} />
              </section>
            ) : null}

            {model.sources.length > 0 ? (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  Sources
                </h3>
                <ul className="space-y-1 text-xs">
                  {model.sources.map((src) => {
                    const href = safeHref(src.url);
                    return (
                      <li key={src.url}>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-300 underline hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                          >
                            {src.title}
                          </a>
                        ) : (
                          <span>{src.title}</span>
                        )}{' '}
                        <span className="text-slate-400">({src.license})</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
