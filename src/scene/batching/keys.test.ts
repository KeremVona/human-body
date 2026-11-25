import { describe, expect, it } from 'vitest';
import { appearanceKey } from './keys';

describe('appearanceKey', () => {
  it('formats bundle, system, tissue, and optional color', () => {
    expect(
      appearanceKey('organs', {
        system: 'digestive',
        tissue: 'organ',
        color: '#7a2e2a',
      }),
    ).toBe('organs|digestive|organ|#7a2e2a');

    expect(
      appearanceKey('skeletal', {
        system: 'skeletal',
        tissue: 'bone',
      }),
    ).toBe('skeletal|skeletal|bone|');
  });

  it('uses fallback key when appearance is undefined', () => {
    expect(appearanceKey('organs', undefined)).toBe('organs|fallback');
  });
});
