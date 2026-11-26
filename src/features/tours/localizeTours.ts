import type { StepId, TourId, TourTextsFile } from './schema';

export type TourStepTextLocalized = {
  title: string;
  body: string;
};

export type TourText = {
  title: string;
  summary: string;
  steps: Record<StepId, TourStepTextLocalized>;
  fallback: boolean;
};

function pickField(
  locVal: string | undefined,
  enVal: string | undefined,
): { text: string; fellBack: boolean } {
  if (locVal && locVal.trim().length > 0) {
    return { text: locVal, fellBack: false };
  }
  return { text: enVal ?? '', fellBack: true };
}

/** Merges localized tour texts over English at field granularity, flagging any English fallback. */
export function localizeTourTexts(
  en: TourTextsFile,
  loc: TourTextsFile | null,
): Record<TourId, TourText> {
  const result: Record<TourId, TourText> = {};

  for (const [tourId, enEntry] of Object.entries(en.tours)) {
    const locEntry = loc?.tours?.[tourId];
    let fallback = loc === null || !locEntry;

    const title = pickField(locEntry?.title, enEntry.title);
    const summary = pickField(locEntry?.summary, enEntry.summary);
    if (title.fellBack || summary.fellBack) {
      fallback = true;
    }

    const steps: Record<StepId, TourStepTextLocalized> = {};
    for (const [stepId, enStep] of Object.entries(enEntry.steps ?? {})) {
      const locStep = locEntry?.steps?.[stepId];
      const stepTitle = pickField(locStep?.title, enStep.title);
      const stepBody = pickField(locStep?.body, enStep.body);
      if (stepTitle.fellBack || stepBody.fellBack) {
        fallback = true;
      }
      steps[stepId] = {
        title: stepTitle.text,
        body: stepBody.text,
      };
    }

    result[tourId] = {
      title: title.text,
      summary: summary.text,
      steps,
      fallback,
    };
  }

  return result;
}
