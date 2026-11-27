import type { JSX } from 'react';

interface CloseUpSvgProps {
  label: string;
}

/** Lung capillary against an air sac wall: O₂ enters, CO₂ exits, blood brightens left-to-right. */
export function LungCapillaryCloseUp({ label }: CloseUpSvgProps): JSX.Element {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 240 120"
      className="h-auto w-full select-none [--cu-co2:#94a3b8] [--cu-deoxy:#881337] [--cu-o2:#38bdf8] [--cu-oxy:#ef4444] [--cu-wall:rgba(255,255,255,0.28)]"
    >
      <defs>
        <linearGradient id="cu-lcap-flow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cu-deoxy)" />
          <stop offset="100%" stopColor="var(--cu-oxy)" />
        </linearGradient>
      </defs>
      <style>{`
        .cu-lc-rbc { animation: cu-lc-flow-r 4.2s linear infinite; }
        .cu-lc-rbc-2 { animation-delay: -1.4s; }
        .cu-lc-rbc-3 { animation-delay: -2.8s; }
        .cu-lc-o2 { animation: cu-lc-down 3s ease-in-out infinite; }
        .cu-lc-co2 { animation: cu-lc-up 3s ease-in-out infinite; }
        @keyframes cu-lc-flow-r {
          0% { transform: translateX(-28px); opacity: 0; }
          12%, 88% { opacity: 0.95; }
          100% { transform: translateX(218px); opacity: 0; }
        }
        @keyframes cu-lc-down {
          0%, 100% { transform: translateY(-4px); opacity: 0.4; }
          50% { transform: translateY(10px); opacity: 1; }
        }
        @keyframes cu-lc-up {
          0%, 100% { transform: translateY(6px); opacity: 0.4; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cu-lc-rbc, .cu-lc-o2, .cu-lc-co2 { animation: none; opacity: 1; }
        }
      `}</style>

      {/* Air sac cavity at top */}
      <path
        d="M20 8C20 34 65 46 120 46C175 46 220 34 220 8Z"
        fill="rgba(56,189,248,0.12)"
        stroke="var(--cu-wall)"
        strokeWidth="1.5"
      />

      {/* Capillary tube pressed against the air-sac wall */}
      <path
        d="M14 68Q120 52 226 68L226 94Q120 78 14 94Z"
        fill="url(#cu-lcap-flow)"
        fillOpacity="0.24"
        stroke="var(--cu-wall)"
        strokeWidth="1.5"
      />

      {/* Red blood cells brightening along the capillary */}
      <ellipse className="cu-lc-rbc" cx="20" cy="76" rx="9" ry="5.5" fill="#9f1239" />
      <ellipse className="cu-lc-rbc cu-lc-rbc-2" cx="20" cy="76" rx="9" ry="5.5" fill="#e11d48" />
      <ellipse className="cu-lc-rbc cu-lc-rbc-3" cx="20" cy="76" rx="9" ry="5.5" fill="#f87171" />

      {/* O2 diffusing from air sac into capillary */}
      <g className="cu-lc-o2" fill="var(--cu-o2)">
        <circle cx="80" cy="36" r="2.5" />
        <circle cx="102" cy="40" r="2.5" />
        <text x="62" y="34" fontSize="9" fontWeight="600">O₂</text>
      </g>

      {/* CO2 diffusing out of capillary into air sac */}
      <g className="cu-lc-co2" fill="var(--cu-co2)">
        <circle cx="152" cy="54" r="2.5" />
        <circle cx="172" cy="48" r="2.5" />
        <text x="176" y="42" fontSize="9" fontWeight="600">CO₂</text>
      </g>
    </svg>
  );
}
