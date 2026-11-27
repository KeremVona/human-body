import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import enJourneys from '../../../content/en/journeys.json';
import rawJourneys from '../../../content/journeys.json';
import trJourneys from '../../../content/tr/journeys.json';
import { setActiveLocale } from '../../i18n/t';
import { localizeJourneyTexts } from './localizeJourneys';
import { MetersBox } from './MetersBox';
import { JourneysFileSchema, JourneyTextsFileSchema } from './schema';

const digestionDef = JourneysFileSchema.parse(rawJourneys).journeys[0];
const enTexts = localizeJourneyTexts(
  JourneyTextsFileSchema.parse(enJourneys),
  JourneyTextsFileSchema.parse(enJourneys),
).digestion;
const trTexts = localizeJourneyTexts(
  JourneyTextsFileSchema.parse(enJourneys),
  JourneyTextsFileSchema.parse(trJourneys),
).digestion;

afterEach(() => {
  cleanup();
  setActiveLocale('en');
});

describe('MetersBox', () => {
  it('renders pre-migration digestion text identically in English and toggles open/closed', async () => {
    const user = userEvent.setup();
    render(
      <MetersBox
        meters={digestionDef.meters}
        values={{ carbs: 60, protein: 50, fat: 40, water: 10, absorbed: 15 }}
        title={enTexts.metersTitle}
        note={enTexts.metersNote}
        meterTexts={enTexts.meters}
      />,
    );

    expect(screen.getByText("What's been digested")).toBeInTheDocument();
    expect(screen.getByText('60% broken down, 15% absorbed')).toBeInTheDocument();
    expect(screen.getByText('50% broken down, 15% absorbed')).toBeInTheDocument();
    expect(screen.getByText('40% broken down, 15% absorbed')).toBeInTheDocument();
    expect(screen.getByText('10% absorbed')).toBeInTheDocument();
    expect(screen.getByText('Rounded teaching values')).toBeInTheDocument();
    expect(screen.queryByText('Absorbed')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: "What's been digested" });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Rounded teaching values')).not.toBeInTheDocument();
  });

  it('renders pre-migration digestion text identically in Turkish', () => {
    setActiveLocale('tr');
    render(
      <MetersBox
        meters={digestionDef.meters}
        values={{ carbs: 60, protein: 50, fat: 40, water: 10, absorbed: 15 }}
        title={trTexts.metersTitle}
        note={trTexts.metersNote}
        meterTexts={trTexts.meters}
      />,
    );

    expect(screen.getByText('Neler sindirildi')).toBeInTheDocument();
    expect(screen.getByText('%60 parçalandı, %15 emildi')).toBeInTheDocument();
    expect(screen.getByText('%50 parçalandı, %15 emildi')).toBeInTheDocument();
    expect(screen.getByText('%40 parçalandı, %15 emildi')).toBeInTheDocument();
    expect(screen.getByText('%10 emildi')).toBeInTheDocument();
    expect(screen.getByText('Yuvarlanmış öğretici değerler')).toBeInTheDocument();
  });

  it('formats decimal values without trailing zeros for non-digestion meters', () => {
    render(
      <MetersBox
        meters={[{ id: 'co2', unit: '%', max: 100, decimals: 2 }]}
        values={{ co2: 0.04 }}
        title="In this air"
        meterTexts={{ co2: { label: 'Carbon dioxide', value: '{v}%' } }}
      />,
    );
    expect(screen.getByText('0.04%')).toBeInTheDocument();
  });
});
