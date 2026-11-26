import type { JSX } from 'react';
import { useAppSelector } from '../../app/hooks';
import { useT } from '../../i18n/t';
import { usePreviewState } from '../../scene/previewState';

/** Status chip displayed while the fast skeletal preview is visible and the interactive skeleton is still loading. */
export function LoadingDetailsChip(): JSX.Element | null {
  const tr = useT();
  const preview = usePreviewState();
  const skeletalReady = useAppSelector(
    (s) => s.assets.bundles.skeletal === 'ready',
  );

  if (skeletalReady || preview !== 'shown') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none rounded-full border border-white/10 bg-slate-900/75 px-3.5 py-1 text-xs text-slate-200 shadow-lg backdrop-blur-md"
    >
      {tr('loading.details')}
    </div>
  );
}
