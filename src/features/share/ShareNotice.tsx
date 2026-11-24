import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useT, type MessageKey } from '../../i18n/t';
import { noticeDismissed, type ShareNoticeReason } from './shareSlice';

const MESSAGE_KEYS: Record<ShareNoticeReason, MessageKey> = {
  skipped: 'share.noticeSkipped',
  'newer-version': 'share.noticeNewer',
  malformed: 'share.noticeMalformed',
};

/** Dismissible status toast reporting share-link decode or stale-id warnings. */
export function ShareNotice(): JSX.Element | null {
  const notice = useAppSelector((s) => s.share.notice);
  const dispatch = useAppDispatch();
  const tr = useT();

  if (!notice) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-900/95 px-4 py-2 text-xs text-slate-100 shadow-lg ring-1 ring-white/15 backdrop-blur-md"
    >
      <span>{tr(MESSAGE_KEYS[notice])}</span>
      <button
        type="button"
        aria-label={tr('share.dismissNoticeAria')}
        onClick={() => dispatch(noticeDismissed())}
        className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        {tr('app.dismiss')}
      </button>
    </div>
  );
}
