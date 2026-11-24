import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pin } from './pinsSlice';
import { loadPins, savePins } from './storage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const validPin: Pin = {
  id: 'pin-1',
  meshId: 'femur--l',
  local: [0.1, 0.2, 0.3],
  label: 'Trochanter',
  note: 'Insertion site',
  createdAt: 1000,
};

describe('pins storage', () => {
  it('loadPins drops invalid entries', () => {
    localStorage.setItem(
      'atlas.pins.v1',
      JSON.stringify([
        validPin,
        { ...validPin, id: 'bad', meshId: 'Bad Id' },
        'x',
      ]),
    );
    expect(loadPins()).toEqual([validPin]);
  });

  it('savePins never writes shared pins', () => {
    const sharedPin: Pin = { ...validPin, id: 'pin-2', shared: true };
    expect(savePins([validPin, sharedPin])).toBe(true);
    const saved = JSON.parse(localStorage.getItem('atlas.pins.v1') ?? '[]');
    expect(saved).toEqual([validPin]);
  });

  it('handles storage errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(loadPins()).toEqual([]);
    expect(savePins([validPin])).toBe(false);
  });
});
