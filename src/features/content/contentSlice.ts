import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from '@reduxjs/toolkit';
import type { StructureId } from '../../data/ids';
import { loadManifest } from '../../data/manifest';
import type { AssetsState } from '../assets/assetsSlice';
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

export type StructureEntry = StructureFile['entries'][number];

export type SystemStructuresState = {
  status: 'loading' | 'ready';
  entries: Record<StructureId, StructureEntry>;
};

export type ContentState = {
  taxonomy: Taxonomy | null;
  index: IndexFile | null;
  structures: Partial<Record<SystemId, SystemStructuresState>>;
};

const initialState: ContentState = {
  taxonomy: null,
  index: null,
  structures: {},
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

/** Bootstraps manifest, taxonomy, and the English structure index in parallel. */
export const bootstrap = createAsyncThunk<
  { manifest: Manifest; taxonomy: Taxonomy; index: IndexFile },
  void,
  { state: { assets: AssetsState } }
>(
  'content/bootstrap',
  async () => {
    const base = import.meta.env.BASE_URL;
    const [manifest, taxonomy, index] = await Promise.all([
      loadManifest(),
      fetchValidated(`${base}content/taxonomy.json`, TaxonomySchema),
      fetchValidated(`${base}content/en/index.json`, IndexFileSchema),
    ]);
    return { manifest, taxonomy, index };
  },
  {
    condition: (_arg, { getState }) => getState().assets.boot === 'idle',
  },
);

/** Fetches detailed descriptions for a single anatomical system; 404 or mismatched system becomes empty ready state. */
export const loadStructures = createAsyncThunk<
  Record<StructureId, StructureEntry>,
  SystemId,
  { state: { content: ContentState } }
>(
  'content/loadStructures',
  async (system) => {
    const url = `${import.meta.env.BASE_URL}content/en/structures/${system}.json`;
    const res = await fetch(url);
    if (res.status === 404) {
      return {};
    }
    if (!res.ok) {
      console.error(`Failed to load ${url} (${res.status})`);
      return {};
    }
    try {
      const json: unknown = await res.json();
      const parsed = StructureFileSchema.parse(json);
      if (parsed.system !== system) {
        console.error(
          `Expected structures/${system}.json to declare system "${system}", got "${parsed.system}"`,
        );
        return {};
      }
      const entries: Record<StructureId, StructureEntry> = {};
      for (const entry of parsed.entries) {
        entries[entry.id] = entry;
      }
      return entries;
    } catch (error) {
      console.error(`Invalid structure content in ${url}`, error);
      return {};
    }
  },
  {
    condition: (system, { getState }) => {
      const existing = getState().content.structures[system];
      return existing === undefined;
    },
  },
);

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(bootstrap.fulfilled, (state, action) => {
      state.taxonomy = action.payload.taxonomy;
      state.index = action.payload.index;
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
  },
});

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
