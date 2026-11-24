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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  encode?: typeof encodeViewState;
}): JSX.Element {
  const dispatch = useAppDispatch();
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(0, link.length);
      }
    }
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
          aria-label="Share view"
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
              Share link
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
                onClick={() => void handleCopy()}
                disabled={!link}
                className="shrink-0 rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:pointer-events-none disabled:opacity-40"
              >
                Copy link
              </button>
            </div>

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
              <span>Include my pins</span>
            </label>

            {copied ? (
              <p role="status" className="text-emerald-300">
                Link copied
              </p>
            ) : null}

            {link.length > LONG_LINK_LIMIT ? (
              <p className="text-amber-200">
                This link is long and some apps may cut it off.
              </p>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
