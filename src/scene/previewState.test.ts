import { describe, expect, it, vi } from 'vitest';
import {
  nextPreviewState,
  previewState,
  type PreviewLifecycle,
} from './previewState';

describe('nextPreviewState', () => {
  it('transitions loading -> shown when preview finishes loading before skeletal', () => {
    expect(nextPreviewState('loading', 'loaded', false)).toBe('shown');
  });

  it('transitions loading -> gone when preview fails or skeletal finishes first', () => {
    expect(nextPreviewState('loading', 'failed', false)).toBe('gone');
    expect(nextPreviewState('loading', 'skeletal-ready', false)).toBe('gone');
  });

  it('fades shown -> fading -> gone under normal motion', () => {
    const fading = nextPreviewState('shown', 'skeletal-ready', false);
    expect(fading).toBe('fading');
    expect(nextPreviewState(fading, 'fade-done', false)).toBe('gone');
  });

  it('skips fading and goes straight to gone when reducedMotion is true', () => {
    expect(nextPreviewState('shown', 'skeletal-ready', true)).toBe('gone');
  });

  it('stays gone once gone', () => {
    const events = ['loaded', 'failed', 'skeletal-ready', 'fade-done'] as const;
    for (const ev of events) {
      expect(nextPreviewState('gone', ev, false)).toBe('gone');
    }
  });
});

describe('previewState store', () => {
  it('notifies subscribers on updates and exposes get/set', () => {
    const seen: PreviewLifecycle[] = [];
    const unsubscribe = previewState.subscribe(() => {
      seen.push(previewState.get());
    });
    const spy = vi.fn();
    const unsub2 = previewState.subscribe(spy);

    previewState.set('shown');
    previewState.set('shown'); // no-op when unchanged
    previewState.set('fading');
    previewState.set('gone');

    unsubscribe();
    unsub2();
    previewState.set('loading');

    expect(seen).toEqual(['shown', 'fading', 'gone']);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
