import * as Popover from '@radix-ui/react-popover';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { useId, type JSX, type RefObject } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { SectionAxis } from './sectionPlane';
import {
  sectionAxisSet,
  sectionFlipped,
  sectionPositionSet,
  sectionToggled,
} from './sectionSlice';

const AXES: readonly { value: SectionAxis; label: string }[] = [
  { value: 'axial', label: 'Axial' },
  { value: 'sagittal', label: 'Sagittal' },
  { value: 'coronal', label: 'Coronal' },
];

/** Lazy-loaded toolbar popover controlling cross-section axis, slice position, and flip. */
export function SectionPopover({
  open,
  onOpenChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const { enabled, axis, t } = useAppSelector((s) => s.section);
  const switchId = useId();
  const labelId = useId();
  const axisHeadingId = useId();
  const pct = Math.round(t * 100);

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {triggerRef ? (
        <Popover.Anchor
          virtualRef={triggerRef as unknown as { current: HTMLButtonElement }}
        />
      ) : (
        <Popover.Anchor className="fixed bottom-14 left-1/2 z-40 h-px w-px" />
      )}
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          aria-label="Cross-section"
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
          className="z-50 w-68 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-slate-900/95 p-3.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md focus:outline-none"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <label
                id={labelId}
                htmlFor={switchId}
                className="cursor-pointer text-sm font-medium text-white select-none"
              >
                Cross-section
              </label>
              <Switch.Root
                id={switchId}
                checked={enabled}
                aria-labelledby={labelId}
                onCheckedChange={() => dispatch(sectionToggled())}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-slate-700/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 data-[state=checked]:bg-sky-500"
              >
                <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-4" />
              </Switch.Root>
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                id={axisHeadingId}
                className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase"
              >
                Plane
              </span>
              <RadioGroup.Root
                aria-labelledby={axisHeadingId}
                disabled={!enabled}
                value={axis}
                onValueChange={(val) => {
                  if (
                    val === 'axial' ||
                    val === 'sagittal' ||
                    val === 'coronal'
                  ) {
                    dispatch(sectionAxisSet(val));
                  }
                }}
                className="grid grid-cols-3 gap-1.5"
              >
                {AXES.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      enabled
                        ? 'cursor-pointer border-white/10 hover:bg-white/10'
                        : 'cursor-not-allowed border-white/5 opacity-45'
                    }`}
                  >
                    <RadioGroup.Item
                      value={option.value}
                      aria-label={option.label}
                      disabled={!enabled}
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-400 bg-slate-950 focus-visible:outline-2 focus-visible:outline-sky-400 data-[state=checked]:border-sky-400"
                    >
                      <RadioGroup.Indicator className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    </RadioGroup.Item>
                    <span>{option.label}</span>
                  </label>
                ))}
              </RadioGroup.Root>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Section position</span>
                <span className="text-slate-200 tabular-nums">{pct}%</span>
              </div>
              <Slider.Root
                min={0}
                max={1}
                step={0.005}
                value={[t]}
                disabled={!enabled}
                onValueChange={([val]) => {
                  if (val !== undefined) {
                    dispatch(sectionPositionSet(val));
                  }
                }}
                className="relative flex h-4 w-full touch-none items-center select-none data-[disabled]:opacity-45"
              >
                <Slider.Track className="relative h-1 grow rounded-full bg-white/15">
                  <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
                </Slider.Track>
                <Slider.Thumb
                  aria-label="Section position"
                  className="block h-3.5 w-3.5 rounded-full bg-white shadow ring-1 ring-slate-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                />
              </Slider.Root>
            </div>

            <button
              type="button"
              disabled={!enabled}
              onClick={() => dispatch(sectionFlipped())}
              className="rounded-lg bg-white/10 px-3 py-1.5 font-medium text-slate-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:pointer-events-none disabled:opacity-45"
            >
              Flip side
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
