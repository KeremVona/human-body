import * as Dialog from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';
import { APP_NAME, getRepoUrl } from '../../app/brand';
import { useT, type MessageKey } from '../../i18n/t';

function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

const linkClass =
  'rounded-sm text-sky-300 underline decoration-sky-400/50 underline-offset-2 hover:text-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400';

const SHORTCUT_ROWS: readonly [string, MessageKey][] = [
  ['/', 'about.shortcuts.search'],
  ['H', 'about.shortcuts.hide'],
  ['I', 'about.shortcuts.isolate'],
  ['G', 'about.shortcuts.fade'],
  ['F', 'about.shortcuts.focus'],
  ['Ctrl/Cmd+Z', 'about.shortcuts.undo'],
  ['P', 'about.shortcuts.pin'],
  ['X', 'about.shortcuts.section'],
  ['Esc', 'about.shortcuts.esc'],
  ['← / →', 'about.shortcuts.tours'],
  ['1–6', 'about.shortcuts.presets'],
  ['0', 'about.shortcuts.reset'],
  ['+/−', 'about.shortcuts.zoom'],
];

/** Accessible modal dialog displaying project overview, medical disclaimer, credits, and keyboard shortcuts. */
export function AboutDialog({ trigger }: { trigger: ReactNode }): JSX.Element {
  const tr = useT();
  const repoUrl = safeHref(getRepoUrl());

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-200 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-white">
              {tr('about.title', { appName: APP_NAME })}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={tr('about.close')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-3 leading-relaxed text-slate-300">
            {tr('about.description')}
          </Dialog.Description>

          <p className="mt-4 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100">
            {tr('about.disclaimer')}
          </p>

          <section aria-labelledby="about-credits-heading" className="mt-5">
            <h3
              id="about-credits-heading"
              className="text-xs font-semibold tracking-wider text-slate-400 uppercase"
            >
              {tr('about.creditsHeading')}
            </h3>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-300">
              <li>
                <strong className="text-slate-100">
                  {tr('about.modelsLabel')}
                </strong>{' '}
                <a
                  href="https://github.com/LluisV/Z-Anatomy"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  Z-Anatomy
                </a>{' '}
                {tr('about.modelsTextAfterLink')}
              </li>
              <li>
                <strong className="text-slate-100">
                  {tr('about.contentLabel')}
                </strong>{' '}
                {tr('about.contentAdapted')}{' '}
                <a
                  href="https://en.wikipedia.org"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  {tr('about.wikipedia')}
                </a>{' '}
                (CC-BY-SA 4.0) {tr('about.and')}{' '}
                <a
                  href="https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  {tr('about.openstax')}
                </a>{' '}
                <em>{tr('about.openstaxBook')}</em> (CC-BY 4.0).
              </li>
              <li>{tr('about.licensesSummary')}</li>
              <li>{tr('about.translationNote')}</li>
              <li>{tr('about.offlineNote')}</li>
            </ul>
          </section>

          <section aria-labelledby="about-shortcuts-heading" className="mt-5">
            <h3
              id="about-shortcuts-heading"
              className="text-xs font-semibold tracking-wider text-slate-400 uppercase"
            >
              {tr('about.shortcutsHeading')}
            </h3>
            <table className="mt-2 w-full border-collapse text-xs">
              <tbody>
                {SHORTCUT_ROWS.map(([key, msgKey]) => (
                  <tr key={key} className="border-t border-white/10">
                    <th
                      scope="row"
                      className="w-32 py-1.5 pr-3 text-left font-mono font-semibold text-slate-100"
                    >
                      {key}
                    </th>
                    <td className="py-1.5 text-slate-300">{tr(msgKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {repoUrl ? (
            <div className="mt-5 border-t border-white/10 pt-4 text-xs">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={linkClass}
              >
                {tr('about.sourceLink')}
              </a>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
