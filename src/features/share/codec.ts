import type { MeshId } from '../../data/ids';
import type { SystemId } from '../../data/schema';
import { ViewStateV1Schema, type ViewStateV1 } from './viewState';

export type DecodeResult =
  | { ok: true; view: ViewStateV1; dropped: number }
  | { ok: false; reason: 'newer-version' | 'malformed' };

export type KnownAtlasIds = {
  meshIds: ReadonlySet<MeshId>;
  systems: ReadonlySet<SystemId>;
};

const MAX_DECOMPRESSED_BYTES = 2 * 1024 * 1024;

function round3(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

function dedupeSorted<T extends string>(items: readonly T[]): T[] {
  return [...new Set(items)].sort();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function transformBytes(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  maxBytes?: number,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  const writePromise = writer.write(copy).then(() => writer.close());

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (maxBytes !== undefined && total > maxBytes) {
          throw new Error('payload exceeds max size');
        }
        chunks.push(value);
      }
    }
    await writePromise;
  } catch (err) {
    await reader.cancel().catch(() => {});
    await writePromise.catch(() => {});
    throw err;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** True when a URL hash uses the versioned `#v<N>.` view-state format. */
export function isViewHash(hash: string): boolean {
  return /^#v\d+\./.test(hash);
}

/** Encodes a `ViewStateV1` into `#v1.<base64url(deflate-raw(json))>`, omitting defaults. */
export async function encodeViewState(v: ViewStateV1): Promise<string> {
  const normalized: ViewStateV1 = {
    c: [
      round3(v.c[0]),
      round3(v.c[1]),
      round3(v.c[2]),
      round3(v.c[3]),
      round3(v.c[4]),
      round3(v.c[5]),
    ],
    s: dedupeSorted(v.s),
    h: dedupeSorted(v.h),
    sel: dedupeSorted(v.sel),
  };

  if (v.o) {
    const cleanOpacities: Partial<Record<SystemId, number>> = {};
    for (const sys of Object.keys(v.o).sort() as SystemId[]) {
      const val = v.o[sys];
      if (typeof val === 'number' && val !== 1) {
        cleanOpacities[sys] = val;
      }
    }
    if (Object.keys(cleanOpacities).length > 0) {
      normalized.o = cleanOpacities;
    }
  }

  if (v.i !== undefined) {
    normalized.i = dedupeSorted(v.i);
  }
  if (v.f !== undefined) {
    normalized.f = dedupeSorted(v.f);
  }
  if (v.x !== undefined) {
    normalized.x = v.x;
  }
  if (v.p !== undefined && v.p.length > 0) {
    normalized.p = v.p;
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(normalized));
  const compressed = await transformBytes(
    jsonBytes,
    new CompressionStream('deflate-raw'),
  );
  return `#v1.${bytesToBase64Url(compressed)}`;
}

function filterKnown<T extends string>(
  items: readonly T[],
  known: ReadonlySet<T>,
): { kept: T[]; dropped: number } {
  const kept: T[] = [];
  let dropped = 0;
  for (const item of items) {
    if (known.has(item)) kept.push(item);
    else dropped += 1;
  }
  return { kept: dedupeSorted(kept), dropped };
}

/** Decodes a versioned `#v1.` view-state hash and drops any unknown MeshIds or SystemIds. */
export async function decodeViewState(
  hash: string,
  known: KnownAtlasIds,
): Promise<DecodeResult> {
  const match = /^#v(\d+)\.(.*)$/.exec(hash);
  if (!match) {
    return { ok: false, reason: 'malformed' };
  }

  const version = Number.parseInt(match[1], 10);
  if (version > 1) {
    return { ok: false, reason: 'newer-version' };
  }
  if (version !== 1) {
    return { ok: false, reason: 'malformed' };
  }

  const payload = match[2];
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) {
    return { ok: false, reason: 'malformed' };
  }

  try {
    const compressed = base64UrlToBytes(payload);
    const inflated = await transformBytes(
      compressed,
      new DecompressionStream('deflate-raw'),
      MAX_DECOMPRESSED_BYTES,
    );
    const jsonText = new TextDecoder('utf-8', { fatal: true }).decode(inflated);
    const parsedJson: unknown = JSON.parse(jsonText);
    const validated = ViewStateV1Schema.safeParse(parsedJson);
    if (!validated.success) {
      return { ok: false, reason: 'malformed' };
    }

    const raw = validated.data;
    let dropped = 0;

    const sRes = filterKnown(raw.s, known.systems);
    dropped += sRes.dropped;

    const hRes = filterKnown(raw.h, known.meshIds);
    dropped += hRes.dropped;

    const selRes = filterKnown(raw.sel, known.meshIds);
    dropped += selRes.dropped;

    const cleanView: ViewStateV1 = {
      c: raw.c,
      s: sRes.kept,
      h: hRes.kept,
      sel: selRes.kept,
    };

    if (raw.o) {
      const cleanOpacities: Partial<Record<SystemId, number>> = {};
      for (const [sys, val] of Object.entries(raw.o) as [
        SystemId,
        number | undefined,
      ][]) {
        if (val === undefined) continue;
        if (!known.systems.has(sys)) {
          dropped += 1;
          continue;
        }
        if (val !== 1) {
          cleanOpacities[sys] = val;
        }
      }
      if (Object.keys(cleanOpacities).length > 0) {
        cleanView.o = cleanOpacities;
      }
    }

    if (raw.i !== undefined) {
      const iRes = filterKnown(raw.i, known.meshIds);
      dropped += iRes.dropped;
      cleanView.i = iRes.kept;
    }

    if (raw.f !== undefined) {
      const fRes = filterKnown(raw.f, known.meshIds);
      dropped += fRes.dropped;
      cleanView.f = fRes.kept;
    }

    if (raw.x !== undefined) {
      cleanView.x = raw.x;
    }

    if (raw.p !== undefined) {
      const keptPins = raw.p.filter((pin) => {
        if (known.meshIds.has(pin.m)) return true;
        dropped += 1;
        return false;
      });
      if (keptPins.length > 0) {
        cleanView.p = keptPins;
      }
    }

    return { ok: true, view: cleanView, dropped };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
