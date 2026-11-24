import { Box3, Vector3 } from 'three';
import type { AppThunk } from '../../app/store';
import { parseMeshId, type MeshId } from '../../data/ids';
import { lastHit } from '../../scene/lastHit';
import { selectStructureLookup } from '../content/contentSlice';
import { pinAdded } from './pinsSlice';
import { worldToLocal } from './pinProjection';

export type PinTargetHit = {
  meshId: MeshId;
  point?: [number, number, number] | null;
};

/** Creates a pin at the given hit (or latest pointer hit / mesh center fallback). */
export function addPinAtPointer(explicit?: PinTargetHit): AppThunk {
  return (dispatch, getState, extra) => {
    const state = getState();
    if (state.quiz.status !== 'off') return;

    const latest = lastHit.get();
    const meshId = explicit?.meshId ?? latest?.meshId;
    if (!meshId) return;

    const mesh = extra.registry?.get(meshId);
    if (!mesh || !mesh.visible) return;
    if (!explicit && mesh.userData?.pickable !== true) return;

    let worldPoint: [number, number, number];
    if (explicit?.point) {
      worldPoint = explicit.point;
    } else if (latest && latest.meshId === meshId) {
      worldPoint = [latest.point.x, latest.point.y, latest.point.z];
    } else if (!explicit) {
      return;
    } else {
      const center = new Box3().setFromObject(mesh).getCenter(new Vector3());
      worldPoint = [center.x, center.y, center.z];
    }

    const local = worldToLocal(mesh, worldPoint);
    const lookup = selectStructureLookup(state);
    const entry = lookup.get(parseMeshId(meshId).structureId);
    const label = entry?.names.common ?? meshId;

    dispatch(pinAdded({ meshId, local, label }));
  };
}
