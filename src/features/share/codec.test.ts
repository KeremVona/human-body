import { describe, expect, it } from 'vitest';
import { decodeViewState, encodeViewState, isViewHash } from './codec';
import type { ViewStateV1 } from './viewState';

const known = {
  meshIds: new Set(['femur--l', 'femur--r', 'sternum']),
  systems: new Set(['skeletal', 'muscular'] as const),
};

const view: ViewStateV1 = {
  c: [0.12345, 0, 3.2, 0, 0, 0],
  s: ['skeletal'],
  h: ['sternum'],
  sel: ['femur--l'],
};

describe('view-state codec', () => {
  it('round-trips and rounds the camera', async () => {
    const hash = await encodeViewState(view);
    expect(hash.startsWith('#v1.')).toBe(true);
    expect(hash.slice(4)).not.toMatch(/[+/=]/);
    const r = await decodeViewState(hash, known);
    expect(r).toEqual({
      ok: true,
      dropped: 0,
      view: { ...view, c: [0.123, 0, 3.2, 0, 0, 0] },
    });
  });

  it('omits defaults and sorts ids', async () => {
    const r = await decodeViewState(
      await encodeViewState({
        ...view,
        h: ['sternum', 'femur--r', 'sternum'],
        o: { skeletal: 1 },
        p: [],
      }),
      known,
    );
    expect(r.ok && r.view).toEqual({
      c: [0.123, 0, 3.2, 0, 0, 0],
      s: ['skeletal'],
      h: ['femur--r', 'sternum'],
      sel: ['femur--l'],
    });
  });

  it('decode drops unknown ids and reports them', async () => {
    const r = await decodeViewState(
      await encodeViewState({
        ...view,
        h: ['sternum', 'gone--l'],
        s: ['skeletal', 'nervous'],
      }),
      known,
    );
    expect(r).toMatchObject({
      ok: true,
      dropped: 2,
      view: { h: ['sternum'], s: ['skeletal'] },
    });
  });

  it('decode rejects malformed payloads', async () => {
    for (const h of ['#v1.', '#v1.!!!', '#v1.' + 'A'.repeat(40), '#v1.e30']) {
      expect(await decodeViewState(h, known)).toEqual({
        ok: false,
        reason: 'malformed',
      });
    }
  });

  it('flags newer versions', async () => {
    expect(await decodeViewState('#v2.abc', known)).toEqual({
      ok: false,
      reason: 'newer-version',
    });
  });

  it('recognises view hashes', () => {
    expect(isViewHash('#v1.abc')).toBe(true);
    expect(isViewHash('#debug')).toBe(false);
    expect(isViewHash('')).toBe(false);
  });
});
