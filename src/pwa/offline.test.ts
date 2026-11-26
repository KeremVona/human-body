import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manifest } from '../data/schema';
import {
  downloadForOffline,
  isOfflineReady,
  markOfflineReady,
  offlineSizeMB,
  offlineUrls,
} from './offline';

const sampleManifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-26T10:00:00Z',
  source: {
    name: 'Z-Anatomy',
    version: '2023-05-02',
    license: 'CC-BY-SA-4.0',
  },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.aaaaaaaa.glb',
      bytes: 4_700_000,
      sha256: 'a'.repeat(64),
      meshIds: [],
    },
    {
      id: 'muscular',
      file: 'muscular.bbbbbbbb.glb',
      bytes: 13_700_000,
      sha256: 'b'.repeat(64),
      meshIds: [],
    },
  ],
  meshes: {},
  preview: {
    file: 'skeletal-preview.cccccccc.glb',
    bytes: 490_000,
    sha256: 'c'.repeat(64),
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  },
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('offline utilities', () => {
  it('computes all offline bundle, preview, manifest, and content URLs respecting base path', () => {
    const urls = offlineUrls(sampleManifest, '/human-body/', ['en', 'tr'], [
      'skeletal',
      'muscular',
    ]);
    expect(urls).toContain('/human-body/models/manifest.json');
    expect(urls).toContain('/human-body/models/skeletal-preview.cccccccc.glb');
    expect(urls).toContain('/human-body/models/skeletal.aaaaaaaa.glb');
    expect(urls).toContain('/human-body/models/muscular.bbbbbbbb.glb');
    expect(urls).toContain('/human-body/content/taxonomy.json');
    expect(urls).toContain('/human-body/content/en/index.json');
    expect(urls).toContain('/human-body/content/tr/index.json');
    expect(urls).toContain(
      '/human-body/content/en/structures/skeletal.json',
    );
    expect(urls).toContain(
      '/human-body/content/tr/structures/muscular.json',
    );
  });

  it('computes total MB size rounded across bundles and preview', () => {
    // 4.7M + 13.7M + 0.49M = 18.89M -> 18 MB (or 18 * 1024 * 1024 = 18,874,368 -> ~18 MB)
    expect(offlineSizeMB(sampleManifest)).toBe(18);
  });

  it('aborts cleanly with quota error when remaining storage is insufficient', async () => {
    const fetchFn = vi.fn();
    await expect(
      downloadForOffline({
        urls: ['/models/skeletal.aaaaaaaa.glb'],
        requiredBytes: 30_000_000,
        fetchFn,
        estimateStorage: async () => ({ quota: 50_000_000, usage: 40_000_000 }),
      }),
    ).rejects.toThrow('quota');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetches every URL and emits monotonic progress', async () => {
    const progress: Array<{ done: number; total: number }> = [];
    const fetchFn = vi.fn(async () => new Response('ok', { status: 200 }));

    await downloadForOffline({
      urls: ['/a', '/b', '/c'],
      requiredBytes: 1_000,
      fetchFn,
      estimateStorage: async () => ({ quota: 100_000, usage: 0 }),
      onProgress: (p) => progress.push(p),
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(progress).toEqual([
      { done: 0, total: 3 },
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ]);
  });

  it('maps HTTP failures cleanly', async () => {
    const fetchFn = vi.fn(async () => new Response('err', { status: 500 }));
    await expect(
      downloadForOffline({
        urls: ['/a'],
        requiredBytes: 1_000,
        fetchFn,
        estimateStorage: async () => ({ quota: 100_000, usage: 0 }),
      }),
    ).rejects.toThrow('failed');
  });

  it('persists readiness keyed to manifest.generatedAt', () => {
    expect(isOfflineReady('2026-11-26T10:00:00Z')).toBe(false);
    markOfflineReady('2026-11-26T10:00:00Z');
    expect(isOfflineReady('2026-11-26T10:00:00Z')).toBe(true);
    expect(isOfflineReady('2026-11-27T10:00:00Z')).toBe(false);
  });
});
