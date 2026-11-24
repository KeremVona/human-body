import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useT } from '../../i18n/t';
import { Chip } from '../../ui/Chip';
import { exitFade, exitIsolate } from './dissectionSlice';

/** Active-mode dismissal chips shown above the bottom toolbar during isolate or fade. */
export function ExitChips(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const tr = useT();
  const hasIsolate = useAppSelector((s) => s.dissection.isolated !== null);
  const hasFade = useAppSelector((s) => s.dissection.faded !== null);

  if (!hasIsolate && !hasFade) {
    return null;
  }

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {hasIsolate ? (
        <Chip active onClick={() => dispatch(exitIsolate())}>
          {tr('dissection.exitIsolate')}
        </Chip>
      ) : null}
      {hasFade ? (
        <Chip active onClick={() => dispatch(exitFade())}>
          {tr('dissection.exitFade')}
        </Chip>
      ) : null}
    </div>
  );
}
