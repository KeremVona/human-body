let drawCallsReader: (() => number) | null = null;

/** Dependency-free registry for the active JourneyLayer's visible draw-call counter. */
export const journeyLayerProbe = {
  setReader(fn: (() => number) | null): void {
    drawCallsReader = fn;
  },
  getDrawCalls(): number {
    return drawCallsReader ? drawCallsReader() : 0;
  },
};
