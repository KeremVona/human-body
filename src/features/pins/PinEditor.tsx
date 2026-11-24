import * as Popover from '@radix-ui/react-popover';
import { useId, useState, useSyncExternalStore, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { pinScreens } from './pinProjection';
import {
  editorClosed,
  pinCancelledNew,
  pinEdited,
  type Pin,
} from './pinsSlice';

function PinEditorForm({
  pin,
  isNew,
  anchor,
  onSave,
  onCancel,
}: {
  pin: Pin;
  isNew: boolean;
  anchor: { x: number; y: number };
  onSave: (label: string, note: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const [label, setLabel] = useState(pin.label);
  const [note, setNote] = useState(pin.note);
  const labelId = useId();
  const noteId = useId();

  const canSave = label.trim().length > 0;

  return (
    <Popover.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <Popover.Trigger asChild>
        <span
          aria-hidden="true"
          style={{ left: `${anchor.x}px`, top: `${anchor.y}px` }}
          className="pointer-events-none fixed z-40 h-px w-px"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={isNew ? 'Add pin' : 'Edit pin'}
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3.5 text-slate-100 shadow-2xl backdrop-blur-md focus:outline-none"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSave) return;
              onSave(label, note);
            }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor={labelId}
                className="text-xs font-medium text-slate-300"
              >
                Label
              </label>
              <input
                id={labelId}
                type="text"
                required
                maxLength={80}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-xs text-white focus-visible:outline-2 focus-visible:outline-sky-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={noteId}
                className="text-xs font-medium text-slate-300"
              >
                Note
              </label>
              <textarea
                id={noteId}
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="resize-none rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1.5 text-xs text-white focus-visible:outline-2 focus-visible:outline-sky-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:pointer-events-none disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Popover form editing the active pin's label and note. */
export function PinEditor(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const editingId = useAppSelector((s) => s.pins.editingId);
  const isNewEditing = useAppSelector((s) => s.pins.isNewEditing ?? false);
  const items = useAppSelector((s) => s.pins.items);
  const screens = useSyncExternalStore(pinScreens.subscribe, pinScreens.get);

  const pin = editingId ? items.find((p) => p.id === editingId) : undefined;
  if (!pin || pin.shared) return null;

  const screen = screens.find((s) => s.id === pin.id);
  const anchor = screen
    ? { x: screen.x, y: screen.y }
    : {
        x: typeof window !== 'undefined' ? window.innerWidth / 2 : 320,
        y: typeof window !== 'undefined' ? window.innerHeight / 2 : 240,
      };

  return (
    <PinEditorForm
      key={pin.id}
      pin={pin}
      isNew={isNewEditing}
      anchor={anchor}
      onSave={(nextLabel, nextNote) => {
        dispatch(pinEdited({ id: pin.id, label: nextLabel, note: nextNote }));
        dispatch(editorClosed());
      }}
      onCancel={() => {
        if (isNewEditing) {
          dispatch(pinCancelledNew(pin.id));
        } else {
          dispatch(editorClosed());
        }
      }}
    />
  );
}
