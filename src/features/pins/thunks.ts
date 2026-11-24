import type { AppThunk } from '../../app/store';
import { parseMeshId } from '../../data/ids';
import { lastHit } from '../../scene/lastHit';
import { selectStructureLookup } from '../content/contentSlice';
import { pinAdded } from './pinsSlice';
import { worldToLocal } from './pinProjection';

/** Creates a pin at the latest pickable pointer hit on the surface of the hit mesh. */
export function addPinAtPointer(): AppThunk {
  return (dispatch, getState, extra) => {
    const state = getState();
    if (state.quiz.status !== 'off') return;
    const hit = lastHit.get();
    if (!hit) return;

    const mesh = extra.registry?.get(hit.meshId);
    if (!mesh || !mesh.visible) return;

    const local = worldToLocal(mesh, [hit.point.x, hit.point.y, hit.point.z]);
    const lookup = selectStructureLookup(state);
    const entry = lookup.get(parseMeshId(hit.meshId).structureId);
    const label = entry?.names.common ?? hit.meshId;

    dispatch(pinAdded({ meshId: hit.meshId, local, label }));
  };
}
