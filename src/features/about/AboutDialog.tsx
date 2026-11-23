import * as Dialog from '@radix-ui/react-dialog';
import type { JSX, ReactNode } from 'react';
import { APP_NAME, getRepoUrl } from '../../app/brand';

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

const SHORTCUT_ROWS: readonly [string, string][] = [
  ['H', 'Hide selected structure'],
  ['I', 'Isolate selected structure'],
  ['G', 'Fade other structures'],
  ['F', 'Focus camera on selection'],
  ['Ctrl/Cmd+Z', 'Undo last dissection action'],
  ['Esc', 'Close menu or clear selection'],
  ['1–6', 'Switch to standard anatomical view'],
  ['0', 'Reset camera view'],
  ['+/−', 'Zoom in or out'],
];

/** Accessible modal dialog displaying project overview, medical disclaimer, credits, and keyboard shortcuts. */
export function AboutDialog({ trigger }: { trigger: ReactNode }): JSX.Element {
  const repoUrl = safeHref(getRepoUrl());

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-200 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-white">
              About {APP_NAME}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
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
            An interactive open-source 3D human anatomy atlas designed for fast,
            smooth exploration in desktop and mobile browsers without an account
            or paywall.
          </Dialog.Description>

          <p className="mt-4 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100">
            This atlas is for learning and curiosity. It is not medical advice.
          </p>

          <section aria-labelledby="about-credits-heading" className="mt-5">
            <h3
              id="about-credits-heading"
              className="text-xs font-semibold tracking-wider text-slate-400 uppercase"
            >
              Credits &amp; Licenses
            </h3>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-300">
              <li>
                <strong className="text-slate-100">3D models:</strong>{' '}
                <a
                  href="https://github.com/LluisV/Z-Anatomy"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  Z-Anatomy
                </a>{' '}
                (CC-BY-SA 4.0), built on BodyParts3D (© The Database Center for
                Life Science, CC-BY-SA 2.1 Japan / CC-BY 4.0). Only Z-Anatomy
                and BodyParts3D geometry ships in this repository;
                non-commercial (CC-BY-NC) reference models are excluded.
              </li>
              <li>
                <strong className="text-slate-100">Content:</strong> adapted in
                plain English from{' '}
                <a
                  href="https://en.wikipedia.org"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  Wikipedia
                </a>{' '}
                (CC-BY-SA 4.0) and{' '}
                <a
                  href="https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={linkClass}
                >
                  OpenStax
                </a>{' '}
                <em>Anatomy and Physiology 2e</em> (CC-BY 4.0).
              </li>
              <li>
                The atlas&apos;s models and content are CC-BY-SA 4.0. The code
                is MIT.
              </li>
            </ul>
          </section>

          <section aria-labelledby="about-shortcuts-heading" className="mt-5">
            <h3
              id="about-shortcuts-heading"
              className="text-xs font-semibold tracking-wider text-slate-400 uppercase"
            >
              Keyboard Shortcuts
            </h3>
            <table className="mt-2 w-full border-collapse text-xs">
              <tbody>
                {SHORTCUT_ROWS.map(([key, description]) => (
                  <tr key={key} className="border-t border-white/10">
                    <th
                      scope="row"
                      className="w-32 py-1.5 pr-3 text-left font-mono font-semibold text-slate-100"
                    >
                      {key}
                    </th>
                    <td className="py-1.5 text-slate-300">{description}</td>
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
                Source code on GitHub
              </a>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
