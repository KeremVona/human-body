import { describe, expect, it } from 'vitest';
import { localizeTourTexts } from './localizeTours';
import type { TourTextsFile } from './schema';

const enTexts: TourTextsFile = {
  tours: {
    'arm-bone-to-muscle': {
      title: 'From bone to muscle',
      summary: 'Explore the arm bones and muscles.',
      steps: {
        'step-1': { title: 'Skeleton', body: 'Look at the skeleton.' },
        'step-2': { title: 'Humerus', body: 'Isolate the upper arm.' },
      },
    },
  },
};

describe('localizeTourTexts', () => {
  it('merges partial locale fields with English fallback and sets fallback true', () => {
    const trTexts: TourTextsFile = {
      tours: {
        'arm-bone-to-muscle': {
          title: 'Kemikten kasa',
          summary: 'Kol kemiklerini ve kaslarını keşfedin.',
          steps: {
            'step-1': { title: 'İskelet', body: 'İskelete bakın.' },
            'step-2': { title: 'Humerus' },
          },
        },
      },
    };

    const result = localizeTourTexts(enTexts, trTexts);
    expect(result['arm-bone-to-muscle']).toEqual({
      title: 'Kemikten kasa',
      summary: 'Kol kemiklerini ve kaslarını keşfedin.',
      fallback: true,
      steps: {
        'step-1': { title: 'İskelet', body: 'İskelete bakın.' },
        'step-2': { title: 'Humerus', body: 'Isolate the upper arm.' },
      },
    });
  });

  it('sets fallback false when every tour and step field is translated', () => {
    const fullTr: TourTextsFile = {
      tours: {
        'arm-bone-to-muscle': {
          title: 'Kemikten kasa',
          summary: 'Kol kemiklerini ve kaslarını keşfedin.',
          steps: {
            'step-1': { title: 'İskelet', body: 'İskelete bakın.' },
            'step-2': { title: 'Humerus', body: 'Üst kolu yalıtın.' },
          },
        },
      },
    };

    const result = localizeTourTexts(enTexts, fullTr);
    expect(result['arm-bone-to-muscle'].fallback).toBe(false);
    expect(result['arm-bone-to-muscle'].steps['step-2'].body).toBe(
      'Üst kolu yalıtın.',
    );
  });

  it('falls back completely to English when loc is null', () => {
    const result = localizeTourTexts(enTexts, null);
    expect(result['arm-bone-to-muscle']).toEqual({
      title: 'From bone to muscle',
      summary: 'Explore the arm bones and muscles.',
      fallback: true,
      steps: {
        'step-1': { title: 'Skeleton', body: 'Look at the skeleton.' },
        'step-2': { title: 'Humerus', body: 'Isolate the upper arm.' },
      },
    });
  });
});
