import { Group, Mesh } from 'three';
import { createMeshRegistry, meshIdOf } from './meshRegistry';

it('registers, finds and unregisters meshes; rejects duplicates', () => {
  const r = createMeshRegistry();
  const m = new Mesh();
  r.register('femur--l', m);
  expect(r.get('femur--l')).toBe(m);
  expect(r.size).toBe(1);
  expect(r.ids()).toEqual(['femur--l']);
  expect(() => r.register('femur--l', new Mesh())).toThrow(
    'duplicate mesh id "femur--l"',
  );
  r.unregister(['femur--l']);
  expect(r.size).toBe(0);
});

it('meshIdOf walks up to the nearest valid ancestor', () => {
  const g = new Group();
  g.name = 'femur--l';
  const child = new Mesh();
  child.name = 'femur--l_1';
  g.add(child);
  const plain = new Mesh();
  plain.name = 'sternum';
  const orphan = new Mesh();
  orphan.name = 'Scene';
  expect(meshIdOf(child)).toBe('femur--l');
  expect(meshIdOf(plain)).toBe('sternum');
  expect(meshIdOf(orphan)).toBeNull();
});

it('notifies subscribers after register and unregister batches', () => {
  const r = createMeshRegistry();
  const listener = vi.fn();
  const unsubscribe = r.subscribe(listener);

  r.register('femur--l', new Mesh());
  expect(listener).toHaveBeenCalledTimes(1);

  r.unregister(['femur--l', 'missing--r']);
  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
  r.register('sternum', new Mesh());
  expect(listener).toHaveBeenCalledTimes(2);
});
