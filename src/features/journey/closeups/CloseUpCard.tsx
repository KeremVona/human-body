import { useEffect, useState, type JSX } from 'react';
import { useT } from '../../../i18n/t';
import type { CloseUpId } from '../schema';
import { AlveolusCloseUp } from './AlveolusCloseUp';
import { CapillaryCloseUp } from './CapillaryCloseUp';
import { LungCapillaryCloseUp } from './LungCapillaryCloseUp';

interface CloseUpCardProps {
  id: CloseUpId;
}

/** Compact inline diagram card paired with stages that zoom below 3D mesh resolution. */
export function CloseUpCard({ id }: CloseUpCardProps): JSX.Element {
  const tr = useT();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true,
  );
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const open = isDesktop || mobileExpanded;
  const labelKey = `journey.closeUp.${id}.aria` as const;
  const captionKey = `journey.closeUp.${id}.caption` as const;
  const ariaLabel = tr(labelKey);

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-slate-300">
          {tr('journey.closeUp.label')}
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setMobileExpanded((v) => !v)}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400 sm:hidden"
        >
          {open ? tr('journey.hideDetails') : tr('journey.showDetails')}
        </button>
      </div>

      {open ? (
        <div className="mt-1.5">
          {id === 'capillary' ? (
            <CapillaryCloseUp label={ariaLabel} />
          ) : id === 'lung-capillary' ? (
            <LungCapillaryCloseUp label={ariaLabel} />
          ) : (
            <AlveolusCloseUp label={ariaLabel} />
          )}
          <p className="mt-1 text-[11px] text-slate-300">{tr(captionKey)}</p>
        </div>
      ) : null}
    </div>
  );
}
