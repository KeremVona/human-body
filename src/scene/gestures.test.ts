import { Group, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_PX,
  LONG_PRESS_MS,
  STATIONARY_PX,
  classifyRelease,
  createTapTracker,
  pickMeshId,
} from './gestures';

describe('gesture constants', () => {
  it('matches spec thresholds', () => {
    expect(STATIONARY_PX).toBe(5);
    expect(LONG_PRESS_MS).toBe(500);
    expect(DOUBLE_TAP_MS).toBe(300);
    expect(DOUBLE_TAP_PX).toBe(24);
  });
});

describe('classifyRelease', () => {
  it.each([
    [{ button: 0, pointerType: 'mouse', dx: 2, dy: 2, ms: 120 }, 'click'],
    [{ button: 0, pointerType: 'mouse', dx: 8, dy: 0, ms: 120 }, 'drag'],
    [{ button: 2, pointerType: 'mouse', dx: 1, dy: 1, ms: 200 }, 'context'],
    [{ button: 2, pointerType: 'mouse', dx: 30, dy: 0, ms: 400 }, 'drag'],
    [{ button: 0, pointerType: 'touch', dx: 1, dy: 1, ms: 600 }, 'long-press'],
    [{ button: 0, pointerType: 'touch', dx: 1, dy: 1, ms: 150 }, 'click'],
    [{ button: 0, pointerType: 'mouse', dx: 1, dy: 1, ms: 900 }, 'click'],
  ] as const)('classifyRelease(%o) = %s', (g, want) => {
    expect(classifyRelease(g)).toBe(want);
  });
});

describe('createTapTracker', () => {
  it('detects double taps by time and distance', () => {
    const t = createTapTracker();
    expect(t.tap({ x: 0, y: 0, t: 0 })).toBe('single');
    expect(t.tap({ x: 10, y: 10, t: 250 })).toBe('double');
    expect(t.tap({ x: 10, y: 10, t: 900 })).toBe('single');
    expect(t.tap({ x: 60, y: 10, t: 1000 })).toBe('single');
  });
});

describe('pickMeshId', () => {
  it('skips non-pickable hits and walks up names', () => {
    const ghost = new Mesh();
    ghost.name = 'sternum';
    ghost.userData.pickable = false;

    const femurGroup = new Group();
    femurGroup.name = 'femur--l';
    const femurChild = new Mesh();
    femurChild.userData.pickable = true;
    femurGroup.add(femurChild);

    expect(pickMeshId([{ object: ghost }, { object: femurChild }])).toBe(
      'femur--l',
    );
    expect(pickMeshId([{ object: ghost }])).toBeNull();
  });
});
