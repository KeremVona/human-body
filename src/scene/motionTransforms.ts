import { Quaternion, Vector3, type Mesh } from 'three';
import type { MeshId } from '../data/ids';
import { rotateAboutPivot, scaleAboutPoint } from '../features/motion/math';
import type { HingeDef } from '../features/motion/schema';
import type { MeshRegistry } from './meshRegistry';

type Snapshot = {
  mesh: Mesh;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
};

const _rotPos = new Vector3();
const _rotQ = new Quaternion();
const _offsetVec = new Vector3();

/** Manages snapshotting and exact restoration of moving mesh transforms inside the R3F scene. */
export function createMotionTransforms(registry: MeshRegistry): {
  begin(ids: readonly MeshId[]): void;
  applyHinge(
    def: Pick<HingeDef, 'axis'>,
    pivot: readonly [number, number, number],
    angleDeg: number,
  ): void;
  applyPulse(
    groups: readonly { ids: readonly MeshId[]; scale: number }[],
    center: readonly [number, number, number],
  ): void;
  applyBreath(
    groups: readonly {
      ids: readonly MeshId[];
      center: readonly [number, number, number];
      scale: number;
    }[],
    shifts: readonly {
      ids: readonly MeshId[];
      offset: readonly [number, number, number];
    }[],
  ): void;
  restore(): void;
} {
  const snapshots = new Map<MeshId, Snapshot>();

  return {
    begin(ids) {
      snapshots.clear();
      for (const id of ids) {
        const mesh = registry.get(id);
        if (!mesh) continue;
        snapshots.set(id, {
          mesh,
          position: mesh.position.clone(),
          quaternion: mesh.quaternion.clone(),
          scale: mesh.scale.clone(),
        });
      }
    },
    applyHinge(def, pivot, angleDeg) {
      if (snapshots.size === 0) return;
      const { position, quaternion } = rotateAboutPivot(
        pivot,
        def.axis,
        angleDeg,
      );
      _rotPos.set(position[0], position[1], position[2]);
      _rotQ.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);

      for (const snap of snapshots.values()) {
        snap.mesh.position
          .copy(snap.position)
          .applyQuaternion(_rotQ)
          .add(_rotPos);
        snap.mesh.quaternion.copy(_rotQ).multiply(snap.quaternion);
        snap.mesh.scale.copy(snap.scale);
        snap.mesh.updateMatrixWorld(true);
      }
    },
    applyPulse(groups, center) {
      if (snapshots.size === 0) return;
      for (const group of groups) {
        const offset = scaleAboutPoint(center, group.scale);
        _offsetVec.set(offset[0], offset[1], offset[2]);
        for (const id of group.ids) {
          const snap = snapshots.get(id);
          if (!snap) continue;
          snap.mesh.position
            .copy(snap.position)
            .multiplyScalar(group.scale)
            .add(_offsetVec);
          snap.mesh.quaternion.copy(snap.quaternion);
          snap.mesh.scale.copy(snap.scale).multiplyScalar(group.scale);
          snap.mesh.updateMatrixWorld(true);
        }
      }
    },
    applyBreath(groups, shifts) {
      if (snapshots.size === 0) return;
      for (const group of groups) {
        const k = 1 - group.scale;
        _offsetVec.set(
          group.center[0] * k,
          group.center[1] * k,
          group.center[2] * k,
        );
        for (const id of group.ids) {
          const snap = snapshots.get(id);
          if (!snap) continue;
          snap.mesh.position
            .copy(snap.position)
            .multiplyScalar(group.scale)
            .add(_offsetVec);
          snap.mesh.quaternion.copy(snap.quaternion);
          snap.mesh.scale.copy(snap.scale).multiplyScalar(group.scale);
          snap.mesh.updateMatrixWorld(true);
        }
      }
      for (const shift of shifts) {
        const [ox, oy, oz] = shift.offset;
        for (const id of shift.ids) {
          const snap = snapshots.get(id);
          if (!snap) continue;
          snap.mesh.position.set(
            snap.position.x + ox,
            snap.position.y + oy,
            snap.position.z + oz,
          );
          snap.mesh.quaternion.copy(snap.quaternion);
          snap.mesh.scale.copy(snap.scale);
          snap.mesh.updateMatrixWorld(true);
        }
      }
    },
    restore() {
      for (const snap of snapshots.values()) {
        snap.mesh.position.copy(snap.position);
        snap.mesh.quaternion.copy(snap.quaternion);
        snap.mesh.scale.copy(snap.scale);
        snap.mesh.updateMatrixWorld(true);
      }
      snapshots.clear();
    },
  };
}
