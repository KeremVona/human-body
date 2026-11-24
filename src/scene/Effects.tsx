import { useThree } from '@react-three/fiber';
import {
  EffectComposer,
  N8AO,
  Outline,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useReducer, useState, type JSX } from 'react';
import type { Mesh } from 'three';
import { useAppSelector } from '../app/hooks';
import { isMeshId, parseMeshId } from '../data/ids';
import { selectStructureLookup } from '../features/content/contentSlice';
import { resolveQuality } from '../features/settings/quality';
import { useMeshRegistry } from './meshRegistry';

/** Post-processing pipeline enabled only when resolved graphics quality is `'high'`. */
export function Effects(): JSX.Element | null {
  const qualitySetting = useAppSelector((s) => s.ui.quality);
  const selectedIds = useAppSelector((s) => s.selection.selectedIds);
  const structureLookup = useAppSelector(selectStructureLookup);
  const systems = useAppSelector((s) => s.systems);
  const hidden = useAppSelector((s) => s.dissection.hidden);
  const isolated = useAppSelector((s) => s.dissection.isolated);
  const registry = useMeshRegistry();
  const invalidate = useThree((s) => s.invalidate);

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resolvedQuality = useMemo(() => {
    const coarsePointer =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;
    const cores =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number'
        ? navigator.hardwareConcurrency
        : 4;
    return resolveQuality(qualitySetting, {
      coarsePointer,
      width: viewportWidth,
      cores,
    });
  }, [qualitySetting, viewportWidth]);

  const [registryVersion, bumpRegistryVersion] = useReducer(
    (v: number) => v + 1,
    0,
  );
  useEffect(() => registry.subscribe(bumpRegistryVersion), [registry]);

  const selectedMeshes = useMemo(() => {
    void registryVersion;
    const hiddenSet = new Set(hidden);
    const isolatedSet = isolated ? new Set(isolated) : null;
    const meshes: Mesh[] = [];
    for (const id of selectedIds) {
      if (hiddenSet.has(id) || (isolatedSet !== null && !isolatedSet.has(id))) {
        continue;
      }
      if (isMeshId(id)) {
        const entry = structureLookup.get(parseMeshId(id).structureId);
        const sys = entry ? systems[entry.system] : undefined;
        if (sys && (!sys.enabled || sys.opacity === 0)) continue;
      }
      const mesh = registry.get(id);
      if (mesh) meshes.push(mesh);
    }
    return meshes;
  }, [
    selectedIds,
    structureLookup,
    systems,
    hidden,
    isolated,
    registry,
    registryVersion,
  ]);

  useEffect(() => {
    invalidate();
  }, [resolvedQuality, selectedMeshes, invalidate]);

  if (resolvedQuality !== 'high') {
    return null;
  }

  return (
    <EffectComposer autoClear={false} multisampling={0}>
      <N8AO
        aoRadius={0.2}
        distanceFalloff={0.8}
        intensity={1.5}
        halfRes
        quality="medium"
      />
      <Outline
        selection={selectedMeshes}
        visibleEdgeColor={0x6fa8ff}
        hiddenEdgeColor={0x3b66a8}
        edgeStrength={2.5}
        pulseSpeed={0}
        blur={false}
        xRay
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
