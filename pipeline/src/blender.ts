import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type BlenderRunArgs = {
  blend: string;
  script: string;
  scriptArgs: string[];
};

/** Builds the headless Blender CLI argument list for running a Python script. */
export function blenderArgs(args: BlenderRunArgs): string[] {
  return [
    '-b',
    args.blend,
    '--factory-startup',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
    '-P',
    args.script,
    '--',
    ...args.scriptArgs,
  ];
}

function resolveBlenderPath(): string {
  if (!process.env.BLENDER_PATH) {
    const envPath = path.resolve(import.meta.dirname, '..', '..', '.env.local');
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
  return process.env.BLENDER_PATH || 'blender';
}

/** Runs Blender headless with the given blend file, Python script, and script args. */
export function runBlender(args: BlenderRunArgs): Promise<void> {
  const blenderBin = resolveBlenderPath();
  const cliArgs = blenderArgs(args);

  return new Promise((resolve, reject) => {
    const child = spawn(blenderBin, cliArgs, {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.once('error', (err) => {
      reject(
        new Error(`Failed to start Blender ("${blenderBin}"): ${err.message}`),
      );
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        const detail =
          code !== null ? `exit code ${code}` : `signal ${signal ?? 'unknown'}`;
        reject(new Error(`Blender failed with ${detail}`));
      }
    });
  });
}
