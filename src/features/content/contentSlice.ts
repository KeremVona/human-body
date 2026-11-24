import {
  createAsyncThunk,
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { StructureId } from '../../data/ids';
import { loadManifest } from '../../data/manifest';
import {
  IndexFileSchema,
  StructureFileSchema,
  TaxonomySchema,
  type IndexEntry,
  type IndexFile,
  type Manifest,
  type StructureFile,
  type SystemId,
  type Taxonomy,
} from '../../data/schema';
import type { Locale } from '../../i18n/locale';
import type { AssetsState } from '../assets/assetsSlice';
import { localizeIndex, localizeStructures } from './localize';

export type StructureEntry = StructureFile['entries'][number];

export type SystemStructuresState = {
  status: 'loading' | 'ready';
  entries: Record<StructureId, StructureEntry>;
};

export type ContentState = {
  locale?: Locale;
  taxonomy: Taxonomy | null;
  index: IndexFile | null;
  enIndex?: IndexFile | null;
  structures: Partial<Record<SystemId, SystemStructuresState>>;
  fallback?: {
    index: StructureId[];
    structures: Partial<Record<SystemId, StructureId[]>>;
  };
};

const initialState: ContentState = {
  locale: 'en',
  taxonomy: null,
  index: null,
  enIndex: null,
  structures: {},
  fallback: {
    index: [],
    structures: {},
  },
};

async function fetchValidated<T>(
  url: string,
  schema: { parse(data: unknown): T },
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  const json: unknown = await res.json();
  return schema.parse(json);
}

async function fetchOptional<T>(
  url: string,
  schema: {
    safeParse(data: unknown): { success: true; data: T } | { success: false };
  },
): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function fetchEnStructureFile(
  base: string,
  system: SystemId,
): Promise<StructureFile | null> {
  const url = `${base}content/en/structures/${system}.json`;
  const res = await fetch(url);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    console.error(`Failed to load ${url} (${res.status})`);
    return null;
  }
  try {
    const json: unknown = await res.json();
    const parsed = StructureFileSchema.parse(json);
    if (parsed.system !== system) {
      console.error(
        `Expected structures/${system}.json to declare system "${system}", got "${parsed.system}"`,
      );
      return null;
    }
    return parsed;
  } catch (error) {
    console.error(`Invalid structure content in ${url}`, error);
    return null;
  }
}

function entriesRecord(
  file: StructureFile | null,
): Record<StructureId, StructureEntry> {
  const entries: Record<StructureId, StructureEntry> = {};
  for (const entry of file?.entries ?? []) {
    entries[entry.id] = entry;
  }
  return entries;
}

/** Bootstraps manifest, taxonomy, and structure index (with optional locale overlay). */
export const bootstrap = createAsyncThunk<
  {
    manifest: Manifest;
    taxonomy: Taxonomy;
    index: IndexFile;
    enIndex?: IndexFile;
    locale?: Locale;
    fallbackIndexIds?: StructureId[];
  },
  void,
  { state: { assets: AssetsState; ui?: { locale: Locale } } }
>(
  'content/bootstrap',
  async (_arg, { getState }) => {
    const base = import.meta.env.BASE_URL;
    const locale: Locale = getState().ui?.locale ?? 'en';
    const [manifest, taxonomy, enIndex, locIndex] = await Promise.all([
      loadManifest(),
      fetchValidated(`${base}content/taxonomy.json`, TaxonomySchema),
      fetchValidated(`${base}content/en/index.json`, IndexFileSchema),
      locale !== 'en'
        ? fetchOptional(`${base}content/${locale}/index.json`, IndexFileSchema)
        : Promise.resolve(null),
    ]);
    if (locale === 'en') {
      return {
        manifest,
        taxonomy,
        index: enIndex,
        enIndex,
        locale,
        fallbackIndexIds: [],
      };
    }
    const { file, fallbackIds } = localizeIndex(enIndex, locIndex);
    return {
      manifest,
      taxonomy,
      index: file,
      enIndex,
      locale,
      fallbackIndexIds: [...fallbackIds],
    };
  },
  {
    condition: (_arg, { getState }) => getState().assets.boot === 'idle',
  },
);

/** Fetches detailed descriptions for a single anatomical system; merges non-en locale with English fallback. */
export const loadStructures = createAsyncThunk<
  Record<StructureId, StructureEntry>,
  SystemId,
  { state: { content: ContentState; ui?: { locale: Locale } } }
>(
  'content/loadStructures',
  async (system, { dispatch, getState }) => {
    const base = import.meta.env.BASE_URL;
    const locale: Locale =
      getState().ui?.locale ?? getState().content.locale ?? 'en';
    const enFile = await fetchEnStructureFile(base, system);
    if (!enFile) {
      dispatch(structureFallbacksRecorded({ system, ids: [] }));
      return {};
    }
    if (locale === 'en') {
      dispatch(structureFallbacksRecorded({ system, ids: [] }));
      return entriesRecord(enFile);
    }
    const rawLoc = await fetchOptional(
      `${base}content/${locale}/structures/${system}.json`,
      StructureFileSchema,
    );
    const locFile = rawLoc && rawLoc.system === system ? rawLoc : null;
    const { file, fallbackIds } = localizeStructures(enFile, locFile);
    dispatch(structureFallbacksRecorded({ system, ids: [...fallbackIds] }));
    return entriesRecord(file);
  },
  {
    condition: (system, { getState }) => {
      const existing = getState().content.structures[system];
      return existing === undefined;
    },
  },
);

/** Reloads index and already-loaded system structures when the user switches locales. */
export const reloadLocaleContent = createAsyncThunk<
  {
    locale: Locale;
    index: IndexFile;
    enIndex: IndexFile;
    fallbackIndexIds: StructureId[];
    structures: Partial<Record<SystemId, Record<StructureId, StructureEntry>>>;
    fallbackStructures: Partial<Record<SystemId, StructureId[]>>;
  } | null,
  Locale,
  { state: { content: ContentState; ui?: { locale: Locale } } }
>('content/reloadLocale', async (locale, { getState }) => {
  const base = import.meta.env.BASE_URL;
  const state = getState().content;
  const enIndex =
    state.enIndex ??
    (await fetchValidated(`${base}content/en/index.json`, IndexFileSchema));

  const readySystems = (
    Object.entries(state.structures) as [
      SystemId,
      SystemStructuresState | undefined,
    ][]
  )
    .filter(([, sys]) => sys?.status === 'ready')
    .map(([sysId]) => sysId);

  const [locIndex, loadedSystems] = await Promise.all([
    locale !== 'en'
      ? fetchOptional(`${base}content/${locale}/index.json`, IndexFileSchema)
      : Promise.resolve(null),
    Promise.all(
      readySystems.map(async (sysId) => {
        const enFile = await fetchEnStructureFile(base, sysId);
        if (!enFile) {
          return {
            sysId,
            entries: {} as Record<StructureId, StructureEntry>,
            fallbackIds: [] as StructureId[],
          };
        }
        if (locale === 'en') {
          return {
            sysId,
            entries: entriesRecord(enFile),
            fallbackIds: [] as StructureId[],
          };
        }
        const rawLoc = await fetchOptional(
          `${base}content/${locale}/structures/${sysId}.json`,
          StructureFileSchema,
        );
        const locFile = rawLoc && rawLoc.system === sysId ? rawLoc : null;
        const { file, fallbackIds } = localizeStructures(enFile, locFile);
        return {
          sysId,
          entries: entriesRecord(file),
          fallbackIds: [...fallbackIds],
        };
      }),
    ),
  ]);

  if ((getState().ui?.locale ?? locale) !== locale) {
    return null;
  }

  const indexResult =
    locale === 'en'
      ? { file: enIndex, fallbackIds: new Set<StructureId>() }
      : localizeIndex(enIndex, locIndex);

  const structures: Partial<
    Record<SystemId, Record<StructureId, StructureEntry>>
  > = {};
  const fallbackStructures: Partial<Record<SystemId, StructureId[]>> = {};
  for (const item of loadedSystems) {
    structures[item.sysId] = item.entries;
    fallbackStructures[item.sysId] = item.fallbackIds;
  }

  return {
    locale,
    index: indexResult.file,
    enIndex,
    fallbackIndexIds: [...indexResult.fallbackIds],
    structures,
    fallbackStructures,
  };
});

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    structureFallbacksRecorded(
      state,
      action: PayloadAction<{ system: SystemId; ids: StructureId[] }>,
    ) {
      state.fallback ??= { index: [], structures: {} };
      state.fallback.structures[action.payload.system] = action.payload.ids;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(bootstrap.fulfilled, (state, action) => {
      state.locale = action.payload.locale ?? state.locale ?? 'en';
      state.taxonomy = action.payload.taxonomy;
      state.enIndex = action.payload.enIndex ?? action.payload.index;
      state.index = action.payload.index;
      state.fallback ??= { index: [], structures: {} };
      state.fallback.index = action.payload.fallbackIndexIds ?? [];
    });
    builder.addCase(loadStructures.pending, (state, action) => {
      state.structures[action.meta.arg] = {
        status: 'loading',
        entries: {},
      };
    });
    builder.addCase(loadStructures.fulfilled, (state, action) => {
      state.structures[action.meta.arg] = {
        status: 'ready',
        entries: action.payload,
      };
    });
    builder.addCase(loadStructures.rejected, (state, action) => {
      state.structures[action.meta.arg] = {
        status: 'ready',
        entries: {},
      };
    });
    builder.addCase(reloadLocaleContent.fulfilled, (state, action) => {
      if (!action.payload) return;
      state.locale = action.payload.locale;
      state.enIndex = action.payload.enIndex;
      state.index = action.payload.index;
      state.fallback ??= { index: [], structures: {} };
      state.fallback.index = action.payload.fallbackIndexIds;
      for (const [sysId, entries] of Object.entries(
        action.payload.structures,
      ) as [SystemId, Record<StructureId, StructureEntry>][]) {
        state.structures[sysId] = { status: 'ready', entries };
      }
      for (const [sysId, ids] of Object.entries(
        action.payload.fallbackStructures,
      ) as [SystemId, StructureId[]][]) {
        state.fallback.structures[sysId] = ids;
      }
    });
  },
});

const { structureFallbacksRecorded } = contentSlice.actions;
export const contentReducer = contentSlice.reducer;

/** Memoised map from StructureId to its IndexEntry. */
export const selectStructureLookup = createSelector(
  [(state: { content: ContentState }) => state.content.index],
  (index): Map<StructureId, IndexEntry> => {
    const map = new Map<StructureId, IndexEntry>();
    for (const entry of index?.structures ?? []) {
      map.set(entry.id, entry);
    }
    return map;
  },
);
