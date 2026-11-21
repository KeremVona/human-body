import type { IndexFile } from '../../src/data/schema';
import type { StructureStub } from './resolvePlan';
import { scaffoldIndex } from './scaffold';

it('adds missing stubs, never edits existing entries, sorts by id', () => {
  const femurEntry: IndexFile['structures'][number] = {
    id: 'femur',
    system: 'skeletal',
    region: 'lower-limb',
    paired: true,
    kind: 'bone',
    tissue: 'bone',
    names: { common: 'Thigh bone', synonyms: [] },
    featured: true,
  };
  const existing: IndexFile = {
    locale: 'en',
    structures: [femurEntry],
  };

  const femurStub: StructureStub = {
    id: 'femur',
    displayName: 'Femur',
    system: 'skeletal',
    region: 'lower-limb',
    kind: 'bone',
    tissue: 'bone',
    paired: true,
    meshIds: ['femur--l', 'femur--r'],
  };
  const sternumStub: StructureStub = {
    id: 'sternum',
    displayName: 'Sternum',
    system: 'skeletal',
    region: 'thorax',
    paired: false,
    kind: 'bone',
    tissue: 'bone',
    meshIds: ['sternum'],
  };

  const out = scaffoldIndex(existing, [sternumStub, femurStub]);
  expect(out.structures.map((s) => s.id)).toEqual(['femur', 'sternum']);
  expect(out.structures[0]).toEqual(existing.structures[0]);
  expect(out.structures[1]).toEqual({
    id: 'sternum',
    system: 'skeletal',
    region: 'thorax',
    paired: false,
    kind: 'bone',
    tissue: 'bone',
    names: { common: 'Sternum', synonyms: [] },
    featured: false,
  });
});
