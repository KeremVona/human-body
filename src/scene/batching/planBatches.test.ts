import { describe, expect, it } from 'vitest';
import type { MeshId } from '../../data/ids';
import type { MeshState } from '../resolveMeshState';
import { planBatches } from './planBatches';

function s(overrides: Partial<MeshState> = {}): MeshState {
  return {
    visible: true,
    opacity: 1,
    ghost: false,
    highlight: 'none',
    pickable: true,
    active: false,
    ...overrides,
  };
}

function runSingleGroup(
  entries: Array<[string, MeshState | undefined]>,
  movingIds: string[] = [],
) {
  const members = new Map<string, readonly MeshId[]>([
    ['k', entries.map(([id]) => id as MeshId)],
  ]);
  const states = new Map<MeshId, MeshState>();
  for (const [id, st] of entries) {
    if (st) states.set(id as MeshId, st);
  }
  const moving = new Set(movingIds as MeshId[]);
  return planBatches({ members, states, moving });
}

describe('planBatches', () => {
  it('all base stays base with zero promotions and all instances visible', () => {
    const plan = runSingleGroup([
      ['a', s()],
      ['b', s()],
      ['c', s()],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect(plan.promoted.size).toBe(0);
    expect(plan.instanceVisible.get('a' as MeshId)).toBe(true);
    expect(plan.instanceVisible.get('b' as MeshId)).toBe(true);
    expect(plan.instanceVisible.get('c' as MeshId)).toBe(true);
  });

  it('promotes a single hovered mesh while keeping batch base', () => {
    const plan = runSingleGroup([
      ['a', s({ highlight: 'hovered' })],
      ['b', s()],
      ['c', s()],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect([...plan.promoted]).toEqual(['a']);
    expect(plan.instanceVisible.get('a' as MeshId)).toBe(false);
    expect(plan.instanceVisible.get('b' as MeshId)).toBe(true);
    expect(plan.instanceVisible.get('c' as MeshId)).toBe(true);
  });

  it('maintains exclusivity between promoted and instanceVisible across states', () => {
    const scenarios: Array<{
      entries: Array<[string, MeshState | undefined]>;
      moving?: string[];
    }> = [
      {
        entries: [
          ['a', s()],
          ['b', s({ ghost: true })],
          ['c', s({ highlight: 'selected' })],
          ['d', s({ visible: false })],
        ],
      },
      {
        entries: [
          ['a', s({ ghost: true })],
          ['b', s({ ghost: true })],
          ['c', s()],
        ],
        moving: ['c'],
      },
      {
        entries: [
          ['a', s({ active: true })],
          ['b', undefined],
        ],
      },
    ];

    for (const { entries, moving } of scenarios) {
      const plan = runSingleGroup(entries, moving);
      for (const [rawId, st] of entries) {
        const id = rawId as MeshId;
        const promoted = plan.promoted.has(id);
        const inst = plan.instanceVisible.get(id) ?? false;
        if (st?.visible) {
          expect(promoted !== inst).toBe(true);
        } else {
          expect(promoted).toBe(false);
          expect(inst).toBe(false);
        }
      }
    }
  });

  it('switches batch to ghost when ghosts outnumber bases and promotes kept mesh', () => {
    const plan = runSingleGroup([
      ['a', s({ ghost: true })],
      ['b', s({ ghost: true })],
      ['c', s({ ghost: true })],
      ['d', s()],
    ]);
    expect(plan.batchState.get('k')).toBe('ghost');
    expect([...plan.promoted]).toEqual(['d']);
    expect(plan.instanceVisible.get('a' as MeshId)).toBe(true);
    expect(plan.instanceVisible.get('d' as MeshId)).toBe(false);
  });

  it('flips majority back to base when bases outnumber ghosts', () => {
    const plan = runSingleGroup([
      ['a', s({ ghost: true })],
      ['b', s({ ghost: true })],
      ['c', s()],
      ['d', s()],
      ['e', s()],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect(new Set(plan.promoted)).toEqual(new Set(['a', 'b']));
  });

  it('breaks ghost/base ties in favor of base', () => {
    const plan = runSingleGroup([
      ['a', s({ ghost: true })],
      ['b', s()],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect([...plan.promoted]).toEqual(['a']);
  });

  it('keeps hidden members out of promotion and instance visibility', () => {
    const plan = runSingleGroup([
      ['a', s({ visible: false })],
      ['b', s()],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect(plan.promoted.size).toBe(0);
    expect(plan.instanceVisible.get('a' as MeshId)).toBe(false);
    expect(plan.instanceVisible.get('b' as MeshId)).toBe(true);
  });

  it('marks batch hidden when no members are visible', () => {
    const plan = runSingleGroup([
      ['a', s({ visible: false })],
      ['b', s({ visible: false })],
    ]);
    expect(plan.batchState.get('k')).toBe('hidden');
    expect(plan.promoted.size).toBe(0);
  });

  it('promotes selected mesh inside a ghost batch', () => {
    const plan = runSingleGroup([
      ['a', s({ ghost: true })],
      ['b', s({ ghost: true })],
      ['c', s({ ghost: true, highlight: 'selected' })],
    ]);
    expect(plan.batchState.get('k')).toBe('ghost');
    expect([...plan.promoted]).toEqual(['c']);
    expect(plan.instanceVisible.get('c' as MeshId)).toBe(false);
  });

  it('promotes active agonist inside a base batch', () => {
    const plan = runSingleGroup([
      ['a', s()],
      ['b', s()],
      ['c', s({ active: true })],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect([...plan.promoted]).toEqual(['c']);
  });

  it('promotes moving meshes even when their material matches the batch', () => {
    const plan = runSingleGroup(
      [
        ['a', s()],
        ['b', s()],
      ],
      ['a'],
    );
    expect(plan.batchState.get('k')).toBe('base');
    expect([...plan.promoted]).toEqual(['a']);
    expect(plan.instanceVisible.get('a' as MeshId)).toBe(false);
    expect(plan.instanceVisible.get('b' as MeshId)).toBe(true);
  });

  it('treats missing state as not visible and not promoted', () => {
    const plan = runSingleGroup([
      ['a', s()],
      ['b', undefined],
    ]);
    expect(plan.batchState.get('k')).toBe('base');
    expect(plan.promoted.size).toBe(0);
    expect(plan.instanceVisible.get('b' as MeshId)).toBe(false);
  });
});
