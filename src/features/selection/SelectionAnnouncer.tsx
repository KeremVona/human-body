import type { JSX } from 'react';
import { useAppSelector } from '../../app/hooks';
import { useT } from '../../i18n/t';
import { selectInspectorModel } from '../inspector/selectors';

/** Visually hidden polite live region announcing structure selection changes. */
export function SelectionAnnouncer(): JSX.Element {
  const model = useAppSelector(selectInspectorModel);
  const tr = useT();

  let message = '';
  if (model) {
    if (model.side === 'Left') {
      message = tr('selection.selectedLeft', { name: model.common });
    } else if (model.side === 'Right') {
      message = tr('selection.selectedRight', { name: model.common });
    } else if (model.side === 'Both') {
      message = tr('selection.selectedBoth', { name: model.common });
    } else {
      message = tr('selection.selectedSingle', { name: model.common });
    }
  }

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
