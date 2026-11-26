import * as Popover from '@radix-ui/react-popover';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useT } from '../../i18n/t';
import { tourHash } from '../tours/tourHash';
import { selectCurrentStep } from '../tours/tourSlice';
import { encodeViewState } from './codec';
import { captureViewState } from './thunks';

const LONG_LINK_LIMIT = 4000;

/** Lazy-loaded Share popover capturing the current view state into a `#v1.` URL. */
export function SharePopover({
  open,
  onOpenChange,
  trigger,
  triggerRef,
  encode = encodeViewState,
  isDev = import.meta.env.DEV,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  encode?: typeof encodeViewState;
  isDev?: boolean;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const tr = useT();
  const [includePins, setIncludePins] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const checkId = useId();

  const systems = useAppSelector((s) => s.systems);
  const dissection = useAppSelector((s) => s.dissection);
  const selectedIds = useAppSelector((s) => s.selection.selectedIds);
  const section = useAppSelector((s) => s.section);
  const pins = useAppSelector((s) => s.pins.items);
  const activeTourStep = useAppSelector(selectCurrentStep);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const view = dispatch(captureViewState({ includePins }));
    void encode(view).then((hash) => {
      if (cancelled) return;
      const base =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : '';
      setLink(`${base}${hash}`);
      setCopied(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    includePins,
    encode,
    dispatch,
    systems,
    dissection,
    selectedIds,
    section,
    pins,
  ]);

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(0, link.length);
      }
    }
  };

  const handleCopyStepLink = async () => {
    if (!activeTourStep) return;
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : '';
    await handleCopyText(
      `${base}${tourHash(activeTourStep.tourId, activeTourStep.index)}`,
    );
  };

  const handleCopyTourStepJson = async () => {
    const view = dispatch(captureViewState({ includePins: false }));
    const { p: _ignored, ...stepView } = view;
    void _ignored;
    await handleCopyText(
      JSON.stringify({ id: 'step-x', view: stepView }, null, 2),
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      ) : triggerRef ? (
        <Popover.Anchor
          virtualRef={triggerRef as unknown as { current: HTMLButtonElement }}
        />
      ) : (
        <Popover.Anchor className="fixed top-14 right-4 z-40 h-px w-px" />
      )}
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label={tr('share.dialogAria')}
          onInteractOutside={(e) => {
            if (
              triggerRef?.current &&
              e.target instanceof Node &&
              triggerRef.current.contains(e.target)
            ) {
              e.preventDefault();
            }
          }}
          onCloseAutoFocus={(e) => {
            if (triggerRef?.current) {
              e.preventDefault();
              triggerRef.current.focus();
            }
          }}
          className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-slate-900/95 p-3.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md focus:outline-none"
        >
          <div className="flex flex-col gap-2.5">
            <label
              htmlFor={inputId}
              className="text-xs font-semibold text-slate-300"
            >
              {tr('share.label')}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                readOnly
                value={link}
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-xs text-white focus-visible:outline-2 focus-visible:outline-sky-400"
              />
              <button
                type="button"
                onClick={() => void handleCopyText(link)}
                disabled={!link}
                className="shrink-0 rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:pointer-events-none disabled:opacity-40"
              >
                {tr('share.copyLink')}
              </button>
            </div>

            {activeTourStep ? (
              <button
                type="button"
                onClick={() => void handleCopyStepLink()}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-left font-medium text-slate-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                {tr('tour.linkStep')}
              </button>
            ) : null}

            {isDev ? (
              <button
                type="button"
                onClick={() => void handleCopyTourStepJson()}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-left font-mono text-[11px] text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                Copy as tour step
              </button>
            ) : null}

            <label
              htmlFor={checkId}
              className="flex cursor-pointer items-center gap-2 text-slate-200"
            >
              <input
                id={checkId}
                type="checkbox"
                checked={includePins}
                onChange={(e) => setIncludePins(e.target.checked)}
                className="h-3.5 w-3.5 accent-sky-500"
              />
              <span>{tr('share.includePins')}</span>
            </label>

            {copied ? (
              <p role="status" className="text-emerald-300">
                {tr('share.copied')}
              </p>
            ) : null}

            {link.length > LONG_LINK_LIMIT ? (
              <p className="text-amber-200">{tr('share.longLink')}</p>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
