import { describe, expect, it, vi } from 'vitest';
import { startPreloads } from './scene/preloadOrder';

function createMetaDoc(tags: Record<string, string>): Document {
  const doc = document.implementation.createHTMLDocument('preload-test');
  for (const [name, content] of Object.entries(tags)) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    doc.head.appendChild(meta);
  }
  return doc;
}

describe('startPreloads', () => {
  it('preloads skeletal-preview before skeletal, and calls skeletal only after preview resolves', async () => {
    const doc = createMetaDoc({
      'atlas-preview': '/models/skeletal-preview.7b4156d0.glb',
      'atlas-skeletal': '/models/skeletal.6c6d593d.glb',
    });

    const calls: string[] = [];
    let resolvePreview!: () => void;
    const preload = vi.fn((url: string) => {
      calls.push(url);
      if (url.includes('preview')) {
        return new Promise<void>((resolve) => {
          resolvePreview = resolve;
        });
      }
      return Promise.resolve();
    });

    const run = startPreloads(doc, preload);
    expect(calls).toEqual(['/models/skeletal-preview.7b4156d0.glb']);

    resolvePreview();
    await run;
    expect(calls).toEqual([
      '/models/skeletal-preview.7b4156d0.glb',
      '/models/skeletal.6c6d593d.glb',
    ]);
  });

  it('still starts full skeletal preload even if preview preload rejects', async () => {
    const doc = createMetaDoc({
      'atlas-preview': '/models/skeletal-preview.7b4156d0.glb',
      'atlas-skeletal': '/models/skeletal.6c6d593d.glb',
    });

    const calls: string[] = [];
    const preload = vi.fn((url: string) => {
      calls.push(url);
      if (url.includes('preview')) {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve();
    });

    await startPreloads(doc, preload);
    expect(calls).toEqual([
      '/models/skeletal-preview.7b4156d0.glb',
      '/models/skeletal.6c6d593d.glb',
    ]);
  });

  it('falls back cleanly when atlas-preview meta is absent', async () => {
    const doc = createMetaDoc({
      'atlas-skeletal': '/models/skeletal.6c6d593d.glb',
    });
    const calls: string[] = [];
    const preload = vi.fn((url: string) => {
      calls.push(url);
      return Promise.resolve();
    });

    await startPreloads(doc, preload);
    expect(calls).toEqual(['/models/skeletal.6c6d593d.glb']);
  });
});
