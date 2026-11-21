import { blenderArgs, runBlender } from './blender';

it('builds headless Blender CLI arguments with --disable-autoexec', () => {
  expect(
    blenderArgs({
      blend: 'pipeline/source/Z-Anatomy.blend',
      script: 'pipeline/blender/inventory.py',
      scriptArgs: ['--out', 'pipeline/out/inventory.json'],
    }),
  ).toEqual([
    '-b',
    'pipeline/source/Z-Anatomy.blend',
    '--factory-startup',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
    '-P',
    'pipeline/blender/inventory.py',
    '--',
    '--out',
    'pipeline/out/inventory.json',
  ]);
});

it('rejects with exit code when executable exits non-zero', async () => {
  const prev = process.env.BLENDER_PATH;
  process.env.BLENDER_PATH = process.execPath;
  try {
    await expect(
      runBlender({
        blend: 'unused.blend',
        script: 'unused.py',
        scriptArgs: [],
      }),
    ).rejects.toThrow(/exit code \d+/i);
  } finally {
    if (prev === undefined) {
      delete process.env.BLENDER_PATH;
    } else {
      process.env.BLENDER_PATH = prev;
    }
  }
});
