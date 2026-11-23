import * as Popover from '@radix-ui/react-popover';
import * as RadioGroup from '@radix-ui/react-radio-group';
import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { IconButton } from '../../ui/IconButton';
import type { QualitySetting } from './quality';
import { qualitySet } from './uiSlice';

const OPTIONS: readonly {
  value: QualitySetting;
  label: string;
  hint: string;
}[] = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'Adapts to device speed and screen size',
  },
  {
    value: 'high',
    label: 'High',
    hint: 'Ambient occlusion, selection outline, Fresnel ghosts',
  },
  {
    value: 'low',
    label: 'Low',
    hint: 'Faster rendering without post-processing',
  },
];

/** Top-bar popover control for selecting graphics quality (`Auto`, `High`, `Low`). */
export function SettingsMenu(): JSX.Element {
  const quality = useAppSelector((s) => s.ui.quality);
  const dispatch = useAppDispatch();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton label="Settings" className="h-8 w-8">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="M8.6 2.5h2.8l.4 1.9c.5.15.96.35 1.4.6l1.7-1.05 2 2-1.05 1.7c.25.44.45.9.6 1.4l1.9.4v2.8l-1.9.4c-.15.5-.35.96-.6 1.4l1.05 1.7-2 2-1.7-1.05c-.44.25-.9.45-1.4.6l-.4 1.9H8.6l-.4-1.9a5.9 5.9 0 0 1-1.4-.6l-1.7 1.05-2-2 1.05-1.7a5.9 5.9 0 0 1-.6-1.4l-1.9-.4V8.6l1.9-.4c.15-.5.35-.96.6-1.4L3.1 5.1l2-2 1.7 1.05c.44-.25.9-.45 1.4-.6l.4-1.9Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle
              cx="10"
              cy="10"
              r="2.4"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </IconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-40 w-64 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md focus:outline-none"
        >
          <p
            id="graphics-quality-heading"
            className="mb-2 text-xs font-semibold tracking-wide text-slate-300 uppercase"
          >
            Graphics quality
          </p>
          <RadioGroup.Root
            aria-labelledby="graphics-quality-heading"
            value={quality}
            onValueChange={(value) => {
              if (value === 'auto' || value === 'high' || value === 'low') {
                dispatch(qualitySet(value));
              }
            }}
            className="flex flex-col gap-1.5"
          >
            {OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5"
              >
                <RadioGroup.Item
                  value={option.value}
                  aria-label={option.label}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-400 bg-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 data-[state=checked]:border-sky-400"
                >
                  <RadioGroup.Indicator className="h-2 w-2 rounded-full bg-sky-400" />
                </RadioGroup.Item>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-white">
                    {option.label}
                  </span>
                  <span className="text-xs text-slate-400">{option.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
