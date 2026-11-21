import { isMeshId, isStructureId, parseMeshId, toMeshId } from './ids';

it('accepts kebab-case structure ids', () => {
  for (const ok of ['femur', 'biceps-brachii', 'vertebra-c1']) {
    expect(isStructureId(ok)).toBe(true);
  }
});

it('rejects malformed structure ids', () => {
  for (const bad of [
    'Femur',
    'femur--l',
    '-femur',
    'femur-',
    'fé-mur',
    'femur_l',
    '',
  ]) {
    expect(isStructureId(bad)).toBe(false);
  }
});

it('accepts mesh ids with an optional side suffix only', () => {
  for (const ok of ['femur--l', 'femur--r', 'sternum']) {
    expect(isMeshId(ok)).toBe(true);
  }
  for (const bad of ['femur--x', 'femur---l', 'femur--', 'Femur.l']) {
    expect(isMeshId(bad)).toBe(false);
  }
});

it('parses and formats sides', () => {
  expect(parseMeshId('femur--l')).toEqual({
    structureId: 'femur',
    side: 'left',
  });
  expect(parseMeshId('femur--r')).toEqual({
    structureId: 'femur',
    side: 'right',
  });
  expect(parseMeshId('sternum')).toEqual({
    structureId: 'sternum',
    side: null,
  });
  expect(() => parseMeshId('Femur.l')).toThrow('invalid mesh id "Femur.l"');
  expect(toMeshId('femur', 'left')).toBe('femur--l');
  expect(toMeshId('femur', 'right')).toBe('femur--r');
  expect(toMeshId('sternum', null)).toBe('sternum');
});
