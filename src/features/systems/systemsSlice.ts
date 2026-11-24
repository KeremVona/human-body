import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import defaultTaxonomy from '../../../content/taxonomy.json';
import {
  SystemIdSchema,
  TaxonomySchema,
  type SystemId,
} from '../../data/schema';

export type SystemState = {
  enabled: boolean;
  opacity: number;
};

export type SystemsState = Record<SystemId, SystemState>;

const parsedTaxonomy = TaxonomySchema.parse(defaultTaxonomy);
const GROUP_SYSTEMS: Record<string, SystemId[]> = Object.fromEntries(
  parsedTaxonomy.uiGroups.map((g) => [g.id, g.systems]),
);

/** Default initial opacity per biological system (integumentary starts semi-transparent). */
export const DEFAULT_OPACITY: Record<SystemId, number> = {
  skeletal: 1,
  muscular: 1,
  cardiovascular: 1,
  nervous: 1,
  respiratory: 1,
  digestive: 1,
  urinary: 1,
  lymphatic: 1,
  integumentary: 0.35,
};

const initialState = Object.fromEntries(
  SystemIdSchema.options.map((id) => [
    id,
    { enabled: id === 'skeletal', opacity: DEFAULT_OPACITY[id] },
  ]),
) as SystemsState;

const systemsSlice = createSlice({
  name: 'systems',
  initialState,
  reducers: {
    systemToggled(state, action: PayloadAction<SystemId>) {
      const entry = state[action.payload];
      entry.enabled = !entry.enabled;
    },
    uiGroupToggled(state, action: PayloadAction<string>) {
      const systems = GROUP_SYSTEMS[action.payload];
      if (!systems || systems.length === 0) return;
      const anyEnabled = systems.some((id) => state[id].enabled);
      const nextEnabled = !anyEnabled;
      for (const id of systems) {
        state[id].enabled = nextEnabled;
      }
    },
    opacitySet(
      state,
      action: PayloadAction<{ systems: SystemId[]; opacity: number }>,
    ) {
      if (!Number.isFinite(action.payload.opacity)) return;
      const clamped = Math.min(1, Math.max(0, action.payload.opacity));
      const rounded = Number((Math.round(clamped * 20) / 20).toFixed(2));
      for (const id of action.payload.systems) {
        state[id].opacity = rounded;
      }
    },
    systemsSet(state, action: PayloadAction<SystemId[]>) {
      const enabledSet = new Set(action.payload);
      for (const id of Object.keys(state) as SystemId[]) {
        state[id].enabled = enabledSet.has(id);
      }
    },
  },
});

export const systemsReducer = systemsSlice.reducer;
export const { systemToggled, uiGroupToggled, opacitySet, systemsSet } =
  systemsSlice.actions;
