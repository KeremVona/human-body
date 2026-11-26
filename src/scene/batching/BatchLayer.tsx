import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useOptionalBatchRegistry } from './batchRegistry';
import type { BatchHandle } from './buildBatches';

const EMPTY_HANDLES: BatchHandle[] = [];

/** Mounts every registered BatchedMesh inside `<Picking>` so batched instances render and raycast cleanly. */
export function BatchLayer() {
  const registry = useOptionalBatchRegistry();
  const invalidate = useThree((s) => s.invalidate);

  const subscribe = useCallback(
    (onChange: () => void) =>
      registry ? registry.subscribe(onChange) : () => {},
    [registry],
  );
  const getSnapshot = useCallback(
    () => (registry ? registry.all() : EMPTY_HANDLES),
    [registry],
  );
  const handles = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    invalidate();
  }, [handles, invalidate]);

  return (
    <>
      {handles.map((handle) => (
        <primitive key={handle.key} object={handle.batch} />
      ))}
    </>
  );
}
