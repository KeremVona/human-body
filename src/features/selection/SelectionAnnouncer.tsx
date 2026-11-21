import type { JSX } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectInspectorModel } from '../inspector/selectors';

/** Visually hidden polite live region announcing structure selection changes. */
export function SelectionAnnouncer(): JSX.Element {
  const model = useAppSelector(selectInspectorModel);

  let message = '';
  if (model) {
    if (model.side === 'Left') {
      message = `Selected ${model.common}, left side.`;
    } else if (model.side === 'Right') {
      message = `Selected ${model.common}, right side.`;
    } else if (model.side === 'Both') {
      message = `Selected ${model.common}, both sides.`;
    } else {
      message = `Selected ${model.common}.`;
    }
  }

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
