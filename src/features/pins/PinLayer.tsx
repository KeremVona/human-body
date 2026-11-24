import { useMemo, useSyncExternalStore, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pinScreens } from './pinProjection';
import { focusPinRequested } from './pinsSlice';

/** Screen-space overlay drawing projected 16 px circular buttons for visible surface pins. */
export function PinLayer(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const pins = useAppSelector((s) => s.pins.items);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');
  const screens = useSyncExternalStore(pinScreens.subscribe, pinScreens.get);

  const pinsById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);

  if (quizActive || screens.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Anatomy pins"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {screens.map((screen) => {
        const pin = pinsById.get(screen.id);
        if (!pin) return null;
        return (
          <button
            key={screen.id}
            type="button"
            aria-label={`Pin: ${pin.label}`}
            title={pin.label}
            style={{
              left: `${screen.x}px`,
              top: `${screen.y}px`,
            }}
            onClick={() => dispatch(focusPinRequested(pin.id))}
            className={`pointer-events-auto absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-amber-400 shadow-md transition-opacity hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
              screen.dimmed ? 'opacity-35' : 'opacity-100'
            }`}
          />
        );
      })}
    </div>
  );
}
