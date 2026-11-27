import type { StructureId } from '../../data/ids';
import type { JourneyId, JourneyTextsFile, StageId } from './schema';

export type LocalizedStageText = {
  title: string;
  body: string;
  note?: string;
};

export type LocalizedJourneyText = {
  title: string;
  summary: string;
  stages: Record<StageId, LocalizedStageText>;
  events: Record<StructureId, string>;
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

/** Merges localized journey strings over English at field granularity, flagging any fallback. */
export function localizeJourneyTexts(
  en: JourneyTextsFile,
  loc: JourneyTextsFile | null,
): Record<JourneyId, LocalizedJourneyText> {
  const result: Record<JourneyId, LocalizedJourneyText> = {};

  for (const [journeyId, enEntry] of Object.entries(en.journeys)) {
    const locEntry =
      loc?.journeys && Object.hasOwn(loc.journeys, journeyId)
        ? loc.journeys[journeyId]
        : undefined;
    let fallback = loc === null || !locEntry;

    const title = pickField(locEntry?.title, enEntry.title);
    const summary = pickField(locEntry?.summary, enEntry.summary);
    if (title.fellBack || summary.fellBack) {
      fallback = true;
    }

    const stages: Record<StageId, LocalizedStageText> = {};
    for (const [stageId, enStage] of Object.entries(enEntry.stages ?? {})) {
      const locStage =
        locEntry?.stages && Object.hasOwn(locEntry.stages, stageId)
          ? locEntry.stages[stageId]
          : undefined;
      const stageTitle = pickField(locStage?.title, enStage.title);
      const stageBody = pickField(locStage?.body, enStage.body);
      if (stageTitle.fellBack || stageBody.fellBack) {
        fallback = true;
      }
      const entry: LocalizedStageText = {
        title: stageTitle.text,
        body: stageBody.text,
      };
      if (enStage.note !== undefined) {
        const note = pickField(locStage?.note, enStage.note);
        if (note.fellBack) fallback = true;
        entry.note = note.text;
      }
      stages[stageId] = entry;
    }

    const events: Record<StructureId, string> = {};
    for (const [eventId, enLabel] of Object.entries(enEntry.events ?? {})) {
      const locLabel =
        locEntry?.events && Object.hasOwn(locEntry.events, eventId)
          ? locEntry.events[eventId]
          : undefined;
      const picked = pickField(locLabel, enLabel);
      if (picked.fellBack) fallback = true;
      events[eventId] = picked.text;
    }

    result[journeyId] = {
      title: title.text,
      summary: summary.text,
      stages,
      events,
      fallback,
    };
  }

  return result;
}
