import { proposeMeshId, updateNameMap } from './nameMap';

it.each([
  ['Femur.l', 'femur--l', false],
  ['Os coxae.r', 'os-coxae--r', false],
  ['Thyroid cartilage_L', 'thyroid-cartilage--l', false],
  ['Kidney left', 'kidney--l', false],
  ['Sternum', 'sternum', false],
  ['Músculo', 'musculo', false],
  ['Vertebra C1.001', 'vertebra-c1', true],
  ['Os sacrum (vertebrae sacrales)', 'os-sacrum-vertebrae-sacrales', true],
  ['***', null, true],
])('proposeMeshId(%s)', (name, meshId, needsReview) => {
  expect(proposeMeshId(name)).toEqual({ meshId, needsReview });
});

it('never changes an existing mapping', () => {
  const r = updateNameMap({ 'Femur.l': 'thigh-bone--l' }, [
    'Femur.l',
    'Tibia.r',
    'Vertebra C1.001',
    '***',
  ]);
  expect(r.map).toEqual({
    'Femur.l': 'thigh-bone--l',
    'Tibia.r': 'tibia--r',
    'Vertebra C1.001': 'vertebra-c1',
  });
  expect(Object.keys(r.map)).toEqual(['Femur.l', 'Tibia.r', 'Vertebra C1.001']);
  expect(r.added).toEqual(['Tibia.r', 'Vertebra C1.001']);
  expect(r.needsReview).toEqual(['Vertebra C1.001', '***']);
});
