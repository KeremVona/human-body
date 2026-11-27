import type { JSX } from 'react';

interface CloseUpSvgProps {
  label: string;
}

/** Tissue capillary diagram showing O₂ release, CO₂ uptake, and blood darkening left-to-right. */
export function CapillaryCloseUp({ label }: CloseUpSvgProps): JSX.Element {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 240 120"
      className="h-auto w-full select-none [--cu-co2:#94a3b8] [--cu-deoxy:#881337] [--cu-o2:#38bdf8] [--cu-oxy:#ef4444] [--cu-wall:rgba(255,255,255,0.28)]"
    >
      <defs>
        <linearGradient id="cu-cap-flow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cu-oxy)" />
          <stop offset="100%" stopColor="var(--cu-deoxy)" />
        </linearGradient>
      </defs>
      <style>{`
        .cu-rbc { animation: cu-flow-r 4.2s linear infinite; }
        .cu-rbc-2 { animation-delay: -1.4s; }
        .cu-rbc-3 { animation-delay: -2.8s; }
        .cu-o2 { animation: cu-out 3s ease-in-out infinite; }
        .cu-co2 { animation: cu-in 3s ease-in-out infinite; }
        @keyframes cu-flow-r {
          0% { transform: translateX(-28px); opacity: 0; }
          12%, 88% { opacity: 0.95; }
          100% { transform: translateX(218px); opacity: 0; }
        }
        @keyframes cu-out {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
        @keyframes cu-in {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cu-rbc, .cu-o2, .cu-co2 { animation: none; opacity: 1; }
        }
      `}</style>

      {/* Body tissue cells */}
      <g fill="rgba(148,163,184,0.14)" stroke="var(--cu-wall)" strokeWidth="1">
        <rect x="26" y="10" width="44" height="22" rx="7" />
        <rect x="98" y="8" width="44" height="24" rx="7" />
        <rect x="170" y="10" width="44" height="22" rx="7" />
        <rect x="34" y="88" width="46" height="22" rx="7" />
        <rect x="108" y="88" width="46" height="22" rx="7" />
        <rect x="168" y="88" width="42" height="22" rx="7" />
      </g>

      {/* Capillary tube */}
      <rect
        x="10"
        y="44"
        width="220"
        height="32"
        rx="16"
        fill="url(#cu-cap-flow)"
        fillOpacity="0.22"
        stroke="var(--cu-wall)"
        strokeWidth="1.5"
      />
      <path d="M22 60h196" stroke="var(--cu-wall)" strokeDasharray="3 5" strokeWidth="1" opacity="0.5" />

      {/* Red blood cells flowing left -> right */}
      <ellipse className="cu-rbc" cx="20" cy="60" rx="9" ry="5.5" fill="#f87171" />
      <ellipse className="cu-rbc cu-rbc-2" cx="20" cy="60" rx="9" ry="5.5" fill="#e11d48" />
      <ellipse className="cu-rbc cu-rbc-3" cx="20" cy="60" rx="9" ry="5.5" fill="#9f1239" />

      {/* O2 leaving capillary to cells */}
      <g className="cu-o2" fill="var(--cu-o2)">
        <circle cx="82" cy="42" r="2.5" />
        <circle cx="150" cy="40" r="2.5" />
        <text x="88" y="39" fontSize="9" fontWeight="600">O₂</text>
        <text x="156" y="38" fontSize="9" fontWeight="600">O₂</text>
      </g>

      {/* CO2 entering capillary from cells */}
      <g className="cu-co2" fill="var(--cu-co2)">
        <circle cx="88" cy="84" r="2.5" />
        <circle cx="158" cy="85" r="2.5" />
        <text x="94" y="86" fontSize="9" fontWeight="600">CO₂</text>
        <text x="164" y="86" fontSize="9" fontWeight="600">CO₂</text>
      </g>
    </svg>
  );
}
