import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Chip } from '../../ui/Chip';
import { exitFade, exitIsolate } from './dissectionSlice';

/** Active-mode dismissal chips shown above the bottom toolbar during isolate or fade. */
export function ExitChips(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const hasIsolate = useAppSelector((s) => s.dissection.isolated !== null);
  const hasFade = useAppSelector((s) => s.dissection.faded !== null);

  if (!hasIsolate && !hasFade) {
    return null;
  }

  return (
    <div className="fixed bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
      {hasIsolate ? (
        <Chip active onClick={() => dispatch(exitIsolate())}>
          Exit isolate
        </Chip>
      ) : null}
      {hasFade ? (
        <Chip active onClick={() => dispatch(exitFade())}>
          Exit fade
        </Chip>
      ) : null}
    </div>
  );
}
