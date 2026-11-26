import { describe, expect, it } from 'vitest';
import { shouldRegisterSW } from './register';

describe('shouldRegisterSW', () => {
  it('returns false in normal dev mode without E2E_SW', () => {
    expect(shouldRegisterSW({ prod: false, e2eSw: false })).toBe(false);
  });

  it('returns true in production builds', () => {
    expect(shouldRegisterSW({ prod: true, e2eSw: false })).toBe(true);
  });

  it('returns true when E2E_SW is enabled', () => {
    expect(shouldRegisterSW({ prod: false, e2eSw: true })).toBe(true);
    expect(shouldRegisterSW({ prod: true, e2eSw: true })).toBe(true);
  });
});
