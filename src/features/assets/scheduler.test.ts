import { nextBundleToLoad } from './scheduler';

const order = ['skeletal', 'muscular', 'organs', 'cardiovascular'];

it('loads one bundle at a time, in order', () => {
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
        skin: 'idle',
      },
      order,
      [],
    ),
  ).toBe('skin');
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
