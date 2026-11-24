import { BUNDLE_LOAD_ORDER, nextBundleToLoad } from './scheduler';

const order = [
  'skeletal',
  'muscular',
  'organs',
  'cardiovascular',
  'lymphatic',
  'skin',
];

it('loads one bundle at a time, in order', () => {
  expect(BUNDLE_LOAD_ORDER).toEqual(order);
  expect(
    nextBundleToLoad({ skeletal: 'idle', muscular: 'idle' }, order, []),
  ).toBe('skeletal');
  expect(
    nextBundleToLoad({ skeletal: 'loading', muscular: 'idle' }, order, []),
  ).toBeNull();
  expect(
    nextBundleToLoad(
      { skeletal: 'ready', muscular: 'idle', organs: 'idle' },
      order,
      [],
    ),
  ).toBe('muscular');
  expect(
    nextBundleToLoad(
      {
        skeletal: 'ready',
        muscular: 'ready',
        organs: 'ready',
        cardiovascular: 'ready',
        lymphatic: 'idle',
        skin: 'idle',
      },
      order,
      [],
    ),
  ).toBe('lymphatic');
  expect(
    nextBundleToLoad(
      {
        skeletal: 'ready',
        muscular: 'ready',
        organs: 'ready',
        cardiovascular: 'ready',
        lymphatic: 'ready',
        skin: 'idle',
      },
      order,
      [],
    ),
  ).toBe('skin');
});

it('puts requested bundles first, skips ready and errored ones, then manifest-only bundles', () => {
  expect(
    nextBundleToLoad(
      { skeletal: 'ready', muscular: 'idle', cardiovascular: 'idle' },
      order,
      ['cardiovascular'],
    ),
  ).toBe('cardiovascular');
  expect(
    nextBundleToLoad(
      {
        skeletal: 'ready',
        muscular: 'error',
        organs: 'ready',
        cardiovascular: 'ready',
        lymphatic: 'ready',
        skin: 'ready',
        extra: 'idle',
      },
      order,
      [],
    ),
  ).toBe('extra');
  expect(
    nextBundleToLoad({ skeletal: 'ready', muscular: 'ready' }, order, []),
  ).toBeNull();
});

it('holds background loads until skeletal is ready, but not requested ones', () => {
  expect(
    nextBundleToLoad({ skeletal: 'error', muscular: 'idle' }, order, []),
  ).toBeNull();
  expect(
    nextBundleToLoad({ skeletal: 'error', muscular: 'idle' }, order, [
      'muscular',
    ]),
  ).toBe('muscular');
});
