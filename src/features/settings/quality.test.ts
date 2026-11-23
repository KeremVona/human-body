import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { loadQualitySetting, resolveQuality } from './quality';
import { qualitySet } from './uiSlice';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('resolveQuality', () => {
  it('honours explicit high and low overrides regardless of device capabilities', () => {
    expect(
      resolveQuality('high', { coarsePointer: true, width: 320, cores: 2 }),
    ).toBe('high');
    expect(
      resolveQuality('low', { coarsePointer: false, width: 1920, cores: 16 }),
    ).toBe('low');
  });

  it('resolves auto using coarse pointer, narrow viewport, and low core count', () => {
    expect(
      resolveQuality('auto', { coarsePointer: true, width: 1280, cores: 8 }),
    ).toBe('low');
    expect(
      resolveQuality('auto', { coarsePointer: false, width: 640, cores: 8 }),
    ).toBe('low');
    expect(
      resolveQuality('auto', { coarsePointer: false, width: 1280, cores: 2 }),
    ).toBe('low');
    expect(
      resolveQuality('auto', { coarsePointer: false, width: 1280, cores: 8 }),
    ).toBe('high');
  });
});

describe('ui quality slice & localStorage persistence', () => {
  it('defaults to auto and persists qualitySet to localStorage["atlas.quality"]', () => {
    const store = makeStore();
    expect(store.getState().ui.quality).toBe('auto');

    store.dispatch(qualitySet('low'));
    expect(store.getState().ui.quality).toBe('low');
    expect(localStorage.getItem('atlas.quality')).toBe('low');

    const reloaded = makeStore();
    expect(reloaded.getState().ui.quality).toBe('low');
  });

  it('falls back to auto when stored value is invalid or localStorage throws', () => {
    localStorage.setItem('atlas.quality', 'ultra');
    expect(loadQualitySetting()).toBe('auto');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadQualitySetting()).toBe('auto');
  });
});
