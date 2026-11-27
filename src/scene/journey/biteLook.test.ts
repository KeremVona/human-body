import { describe, expect, it } from 'vitest';
import { BITE_LOOKS, cloneLook, lerpLook } from './biteLook';

describe('biteLook', () => {
  it('interpolates color, roughness, and transmission across digestion, blood, and air looks', () => {
    const out = cloneLook(BITE_LOOKS.bolus);
    const res = lerpLook(BITE_LOOKS.bolus, BITE_LOOKS.chyme, 0.5, out);

    expect(res).toBe(out);
    expect(out.roughness).toBeCloseTo(
      (BITE_LOOKS.bolus.roughness + BITE_LOOKS.chyme.roughness) / 2,
      5,
    );
    expect(out.transmission).toBeCloseTo(
      (BITE_LOOKS.bolus.transmission + BITE_LOOKS.chyme.transmission) / 2,
      5,
    );

    lerpLook(BITE_LOOKS.chyme, BITE_LOOKS.stool, 2, out);
    expect(out.roughness).toBeCloseTo(BITE_LOOKS.stool.roughness, 5);
    expect(out.transmission).toBeCloseTo(BITE_LOOKS.stool.transmission, 5);
    expect(out.color.getHex()).toBe(BITE_LOOKS.stool.color.getHex());

    lerpLook(BITE_LOOKS['blood-deoxy'], BITE_LOOKS['blood-oxy'], 0.5, out);
    expect(out.roughness).toBeCloseTo(0.16, 5);
    expect(out.transmission).toBe(0);

    lerpLook(BITE_LOOKS['air-fresh'], BITE_LOOKS['air-stale'], 1, out);
    expect(out.roughness).toBeCloseTo(BITE_LOOKS['air-stale'].roughness, 5);
    expect(out.transmission).toBeCloseTo(
      BITE_LOOKS['air-stale'].transmission,
      5,
    );
  });
});
