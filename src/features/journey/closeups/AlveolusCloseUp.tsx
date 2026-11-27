import type { JSX } from 'react';

interface CloseUpSvgProps {
  label: string;
}

/** Grape-like alveolar cluster with capillary net and O₂/CO₂ exchange arrows across the sac wall. */
export function AlveolusCloseUp({ label }: CloseUpSvgProps): JSX.Element {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 240 120"
      className="h-auto w-full select-none [--cu-co2:#94a3b8] [--cu-deoxy:#be123c] [--cu-o2:#38bdf8] [--cu-oxy:#ef4444] [--cu-wall:rgba(255,255,255,0.28)]"
    >
      <style>{`
        .cu-alv-o2 { animation: cu-alv-pulse 2.8s ease-in-out infinite; }
        .cu-alv-co2 { animation: cu-alv-pulse 2.8s ease-in-out infinite -1.4s; }
        @keyframes cu-alv-pulse {
          0%, 100% { opacity: 0.45; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cu-alv-o2, .cu-alv-co2 { animation: none; opacity: 1; }
        }
      `}</style>

      {/* Bronchiole airway stem leading into the alveolar cluster */}
      <path
        d="M16 52h46l22-14M62 52l22 14"
        fill="none"
        stroke="var(--cu-wall)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 52h46l22-14M62 52l22 14"
        fill="none"
        stroke="rgba(56,189,248,0.16)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Grape-like air sacs */}
      <g fill="rgba(56,189,248,0.12)" stroke="var(--cu-wall)" strokeWidth="1.5">
        <circle cx="96" cy="34" r="16" />
        <circle cx="122" cy="28" r="18" />
        <circle cx="146" cy="42" r="17" />
        <circle cx="96" cy="70" r="17" />
        <circle cx="124" cy="82" r="18" />
        <circle cx="148" cy="74" r="19" />
      </g>

      {/* Capillary net wrapping the right sac */}
      <path
        d="M148 16c24 8 34 30 28 52c-4 18-16 32-36 38"
        fill="none"
        stroke="var(--cu-oxy)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M136 52c16-4 32 4 40 16M136 74c14 0 28-4 38-12"
        fill="none"
        stroke="var(--cu-deoxy)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* O2 & CO2 exchange arrows across the alveolar wall */}
      <g className="cu-alv-o2" stroke="var(--cu-o2)" fill="var(--cu-o2)" strokeWidth="1.5">
        <path d="M150 42h20m-4-3l4 3-4 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="180" y="45" fontSize="9" stroke="none" fontWeight="600">O₂</text>
      </g>
      <g className="cu-alv-co2" stroke="var(--cu-co2)" fill="var(--cu-co2)" strokeWidth="1.5">
        <path d="M170 76h-20m4-3l-4 3 4 3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="180" y="79" fontSize="9" stroke="none" fontWeight="600">CO₂</text>
      </g>
    </svg>
  );
}
