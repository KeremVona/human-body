import type { JSX } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { noticeDismissed, type ShareNoticeReason } from './shareSlice';

const MESSAGES: Record<ShareNoticeReason, string> = {
  skipped: 'Some parts in this link no longer exist and were skipped.',
  'newer-version': 'This link was made by a newer version of the atlas.',
  malformed: "This link couldn't be read.",
};

/** Dismissible status toast reporting share-link decode or stale-id warnings. */
export function ShareNotice(): JSX.Element | null {
  const notice = useAppSelector((s) => s.share.notice);
  const dispatch = useAppDispatch();

  if (!notice) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-900/95 px-4 py-2 text-xs text-slate-100 shadow-lg ring-1 ring-white/15 backdrop-blur-md"
      >
        <span>{MESSAGES[notice]}</span>
        <button
          type="button"
          aria-label="Dismiss notice"
          onClick={() => dispatch(noticeDismissed())}
          className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
