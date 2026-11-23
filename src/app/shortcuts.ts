import type { Preset } from '../scene/camera';

export type Command =
  | 'hide'
  | 'isolate'
  | 'fade'
  | 'focus'
  | 'undo'
  | 'deselect'
  | 'context-menu'
  | 'focus-search'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset-view'
  | `preset:${Preset}`;

const PLAIN_KEY_MAP: Record<string, Command> = {
  h: 'hide',
  i: 'isolate',
  g: 'fade',
  f: 'focus',
  '/': 'focus-search',
  escape: 'deselect',
  '1': 'preset:anterior',
  '2': 'preset:posterior',
  '3': 'preset:left',
  '4': 'preset:right',
  '5': 'preset:superior',
  '6': 'preset:inferior',
  '0': 'reset-view',
  '+': 'zoom-in',
  '=': 'zoom-in',
  '-': 'zoom-out',
};

/** Maps a normalized keyboard event descriptor to a viewer Command, or null when ignored. */
export function shortcutFor(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  targetTag: string;
  targetEditable: boolean;
}): Command | null {
  if (e.altKey || e.targetEditable) return null;
  const tag = e.targetTag.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;

  if (e.ctrlKey || e.metaKey) {
    if (!e.shiftKey && e.key.toLowerCase() === 'z') {
      return 'undo';
    }
    return null;
  }

  if (e.shiftKey && e.key === 'F10') {
    return 'context-menu';
  }

  return PLAIN_KEY_MAP[e.key.toLowerCase()] ?? null;
}
