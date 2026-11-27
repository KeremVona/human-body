import { describe, expect, it } from 'vitest';
import { localizeJourneyTexts } from './localizeJourneys';
import type { JourneyTextsFile } from './schema';

const en: JourneyTextsFile = {
  journeys: {
    digestion: {
      title: 'Follow a bite of food',
      summary: 'From mouth to exit.',
      stages: {
        mouth: { title: 'Mouth', body: 'Chewing begins.' },
        exit: { title: 'Exit', body: 'Leaves the tract.', note: 'Not modelled yet.' },
      },
      events: {
        saliva: 'Saliva added',
      },
    },
  },
};

describe('localizeJourneyTexts', () => {
  it('uses complete locale strings with fallback = false', () => {
    const tr: JourneyTextsFile = {
      journeys: {
        digestion: {
          title: 'Bir lokmanın yolculuğu',
          summary: 'Ağızdan çıkışa.',
          stages: {
            mouth: { title: 'Ağız', body: 'Çiğneme başlar.' },
            exit: { title: 'Çıkış', body: 'Kanaldan çıkar.', note: 'Henüz modellenmedi.' },
          },
          events: {
            saliva: 'Tükürük eklenir',
          },
        },
      },
    };
    const localized = localizeJourneyTexts(en, tr);
    expect(localized.digestion).toEqual({
      title: 'Bir lokmanın yolculuğu',
      summary: 'Ağızdan çıkışa.',
      stages: {
        mouth: { title: 'Ağız', body: 'Çiğneme başlar.' },
        exit: { title: 'Çıkış', body: 'Kanaldan çıkar.', note: 'Henüz modellenmedi.' },
      },
      events: {
        saliva: 'Tükürük eklenir',
      },
      fallback: false,
    });
  });

  it('falls back per missing or blank field to English and flags fallback = true', () => {
    const partial: JourneyTextsFile = {
      journeys: {
        digestion: {
          title: '   ',
          summary: 'Özet',
          stages: {
            mouth: { title: 'Ağız' },
          },
          events: {},
        },
      },
    };
    const localized = localizeJourneyTexts(en, partial);
    expect(localized.digestion.fallback).toBe(true);
    expect(localized.digestion.title).toBe('Follow a bite of food');
    expect(localized.digestion.summary).toBe('Özet');
    expect(localized.digestion.stages.mouth).toEqual({
      title: 'Ağız',
      body: 'Chewing begins.',
    });
    expect(localized.digestion.stages.exit).toEqual({
      title: 'Exit',
      body: 'Leaves the tract.',
      note: 'Not modelled yet.',
    });
    expect(localized.digestion.events.saliva).toBe('Saliva added');
  });

  it('falls back completely when locale overlay is null', () => {
    const localized = localizeJourneyTexts(en, null);
    expect(localized.digestion.fallback).toBe(true);
    expect(localized.digestion.title).toBe('Follow a bite of food');
  });
});
