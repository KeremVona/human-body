import { describe, expect, it } from 'vitest';
import enJourneys from '../../content/en/journeys.json';
import trJourneys from '../../content/tr/journeys.json';
import { JourneyTextsFileSchema } from '../features/journey/schema';
import { en } from './messages/en';
import { tr } from './messages/tr';

function flatten(
  obj: Record<string, unknown>,
  prefix = '',
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, val] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      entries.push([full, val]);
    } else if (val && typeof val === 'object') {
      entries.push(...flatten(val as Record<string, unknown>, full));
    }
  }
  return entries;
}

function placeholders(str: string): string[] {
  return [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
}

describe('i18n catalogue key parity', () => {
  it('contains every English leaf key in Turkish as non-empty with identical placeholders', () => {
    const enLeaves = flatten(en);
    const trMap = new Map(flatten(tr));

    expect(enLeaves.length).toBeGreaterThan(50);
    for (const [key, enVal] of enLeaves) {
      const trVal = trMap.get(key);
      expect(trVal, `missing key in tr: ${key}`).toBeDefined();
      expect(trVal!.trim().length, `empty key in tr: ${key}`).toBeGreaterThan(
        0,
      );
      expect(
        placeholders(trVal!),
        `placeholder mismatch on key: ${key}`,
      ).toEqual(placeholders(enVal));
    }

    const enKeys = new Set(enLeaves.map(([k]) => k));
    for (const [key] of trMap) {
      expect(enKeys.has(key), `extra key in tr: ${key}`).toBe(true);
    }
  });

  it('contains every English journey, stage, and event key in Turkish as non-empty', () => {
    const enParsed = JourneyTextsFileSchema.parse(enJourneys);
    const trParsed = JourneyTextsFileSchema.parse(trJourneys);

    for (const [journeyId, enEntry] of Object.entries(enParsed.journeys)) {
      const trEntry = trParsed.journeys[journeyId];
      expect(trEntry, `missing journey in tr: ${journeyId}`).toBeDefined();
      if (enEntry.title) {
        expect(trEntry.title?.trim().length, `missing tr title for ${journeyId}`).toBeGreaterThan(0);
      }
      if (enEntry.summary) {
        expect(trEntry.summary?.trim().length, `missing tr summary for ${journeyId}`).toBeGreaterThan(0);
      }
      for (const [stageId, enStage] of Object.entries(enEntry.stages ?? {})) {
        const trStage = trEntry.stages?.[stageId];
        expect(trStage, `missing stage in tr: ${journeyId}/${stageId}`).toBeDefined();
        if (enStage.title) {
          expect(trStage?.title?.trim().length, `missing tr title for ${journeyId}/${stageId}`).toBeGreaterThan(0);
        }
        if (enStage.body) {
          expect(trStage?.body?.trim().length, `missing tr body for ${journeyId}/${stageId}`).toBeGreaterThan(0);
        }
        if (enStage.note) {
          expect(trStage?.note?.trim().length, `missing tr note for ${journeyId}/${stageId}`).toBeGreaterThan(0);
        }
      }
      for (const [evId, enLabel] of Object.entries(enEntry.events ?? {})) {
        const trLabel = trEntry.events?.[evId];
        expect(trLabel, `missing event in tr: ${journeyId}/events/${evId}`).toBeDefined();
        expect(trLabel!.trim().length, `empty event in tr: ${journeyId}/events/${evId}`).toBeGreaterThan(0);
        expect(placeholders(trLabel!)).toEqual(placeholders(enLabel));
      }
    }
  });
});
