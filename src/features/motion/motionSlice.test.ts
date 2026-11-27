import { describe, expect, it } from 'vitest';
import type { RootState } from '../../app/store';
import type { HingeDef, PulseDef } from './schema';
import {
  motionActivated,
  motionDirectionChanged,
  motionPaused,
  motionPlayed,
  motionReducer,
  motionScrubbed,
  motionSpeedSet,
  motionStopped,
  motionsLoaded,
  selectMotionMoving,
  selectMotionOverrides,
} from './motionSlice';

const hingeDef: HingeDef = {
  id: 'elbow-flexion',
  kind: 'hinge',
  label: 'Elbow flexion',
  view: 'left',
  systems: ['skeletal', 'muscular'],
  moving: ['radius--l'],
  ghost: ['long-head-of-biceps-brachii--l', 'long-head-of-triceps-brachii--l'],
  agonists: {
    flex: ['long-head-of-biceps-brachii--l'],
    extend: ['long-head-of-triceps-brachii--l'],
  },
  pivot: { mesh: 'humerus--l', anchor: [0.5, 0.03, 0.5] },
  axis: [-1, 0, 0],
  range: [0, 145],
  periodS: 4,
};

const pulseDef: PulseDef = {
  id: 'heartbeat',
  kind: 'pulse',
  label: 'Heartbeat',
  view: 'anterior',
  systems: ['cardiovascular'],
  groups: [{ meshes: ['left-atrium'], phase: 0 }],
  bpm: 72,
  amplitude: 0.04,
};

describe('motionSlice & selectMotionOverrides', () => {
  it('handles lifecycle transitions cleanly', () => {
    let state = motionReducer(undefined, { type: 'init' });
    expect(state).toEqual({
      defs: null,
      loadStatus: 'idle',
      activeId: null,
      playing: false,
      owner: null,
      speed: 1,
      direction: null,
      scrubPhase: 0,
      activationSeq: 0,
    });

    state = motionReducer(state, motionsLoaded([hingeDef, pulseDef]));
    expect(state.loadStatus).toBe('ready');

    state = motionReducer(
      state,
      motionActivated({ id: 'elbow-flexion', playing: true }),
    );
    expect(state.activeId).toBe('elbow-flexion');
    expect(state.playing).toBe(true);
    expect(state.direction).toBe('flex');
    expect(state.activationSeq).toBe(1);

    state = motionReducer(
      state,
      motionActivated({ id: 'elbow-flexion', playing: true }),
    );
    expect(state.activationSeq).toBe(2);

    state = motionReducer(state, motionDirectionChanged('extend'));
    expect(state.direction).toBe('extend');

    state = motionReducer(state, motionPaused(0.3));
    expect(state.playing).toBe(false);
    expect(state.scrubPhase).toBe(0.3);

    state = motionReducer(state, motionScrubbed(1));
    expect(state.scrubPhase).toBe(1);
    expect(state.direction).toBe('extend');

    state = motionReducer(state, motionScrubbed(0.75));
    expect(state.scrubPhase).toBe(0.75);

    state = motionReducer(state, motionSpeedSet(0.5));
    expect(state.speed).toBe(0.5);

    state = motionReducer(state, motionPlayed());
    expect(state.playing).toBe(true);

    state = motionReducer(state, motionStopped());
    expect(state.activeId).toBeNull();
    expect(state.playing).toBe(false);
    expect(state.direction).toBeNull();
    expect(state.scrubPhase).toBe(0);
  });

  it('selectMotionOverrides follows hinge direction and returns empty sets when stopped or pulse', () => {
    const base = motionReducer(undefined, motionsLoaded([hingeDef, pulseDef]));

    const stoppedOverrides = selectMotionOverrides({
      motion: base,
    } as Pick<RootState, 'motion'>);
    expect(stoppedOverrides.ghost.size).toBe(0);
    expect(stoppedOverrides.active.size).toBe(0);

    const extending = motionReducer(
      motionReducer(
        base,
        motionActivated({ id: 'elbow-flexion', playing: true }),
      ),
      motionDirectionChanged('extend'),
    );
    const extendOverrides = selectMotionOverrides({
      motion: extending,
    } as Pick<RootState, 'motion'>);
    expect([...extendOverrides.ghost]).toEqual(hingeDef.ghost);
    expect([...extendOverrides.active]).toEqual([
      'long-head-of-triceps-brachii--l',
    ]);

    const pausedFlex = motionReducer(
      motionReducer(
        base,
        motionActivated({ id: 'elbow-flexion', playing: false, phase: 0.25 }),
      ),
      motionDirectionChanged('extend'),
    );
    expect([
      ...selectMotionOverrides({ motion: pausedFlex } as Pick<
        RootState,
        'motion'
      >).active,
    ]).toEqual(['long-head-of-biceps-brachii--l']);

    const pulse = motionReducer(
      base,
      motionActivated({ id: 'heartbeat', playing: true }),
    );
    const pulseOverrides = selectMotionOverrides({ motion: pulse } as Pick<
      RootState,
      'motion'
    >);
    expect(pulseOverrides.ghost.size).toBe(0);
    expect(pulseOverrides.active.size).toBe(0);
  });

  it('selectMotionMoving returns hinge moving meshes, pulse group meshes, and empty when stopped', () => {
    const base = motionReducer(undefined, motionsLoaded([hingeDef, pulseDef]));
    expect(
      selectMotionMoving({ motion: base } as Pick<RootState, 'motion'>).size,
    ).toBe(0);

    const activeHinge = motionReducer(
      base,
      motionActivated({ id: 'elbow-flexion', playing: true }),
    );
    expect([
      ...selectMotionMoving({ motion: activeHinge } as Pick<
        RootState,
        'motion'
      >),
    ]).toEqual(['radius--l']);

    const activePulse = motionReducer(
      base,
      motionActivated({ id: 'heartbeat', playing: true }),
    );
    expect([
      ...selectMotionMoving({ motion: activePulse } as Pick<
        RootState,
        'motion'
      >),
    ]).toEqual(['left-atrium']);

    const stopped = motionReducer(activeHinge, motionStopped());
    expect(
      selectMotionMoving({ motion: stopped } as Pick<RootState, 'motion'>).size,
    ).toBe(0);
  });
});
