/** Application display name mirrored by `<title>` in `index.html`. */
export const APP_NAME = 'Anatomy Atlas';

/** Short tagline mirrored by `<meta name="description">` in `index.html`. */
export const APP_DESCRIPTION =
  'Interactive open-source 3D human anatomy atlas in your browser.';

/** Configured GitHub repository URL when `VITE_REPO_URL` is provided at build time. */
export const REPO_URL: string | undefined =
  import.meta.env.VITE_REPO_URL || undefined;

/** Reads `VITE_REPO_URL` dynamically so tests stubbing env vars observe updated values. */
export function getRepoUrl(): string | undefined {
  return import.meta.env.VITE_REPO_URL || undefined;
}
