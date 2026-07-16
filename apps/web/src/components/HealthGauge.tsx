"use client";

import { useEffect, useState } from "react";
import type { HealthScore } from "@fasttrack/core";

// Geometry verbatim from the design: 270° sweep starting at 135°, r=80.
const START_ANGLE = 135;
const SWEEP = 270;
const RADIUS = 80;
const CENTER = 100;
const DURATION_MS = 1150;

function pointAt(deg: number): readonly [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CENTER + RADIUS * Math.cos(rad), CENTER + RADIUS * Math.sin(rad)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [sx, sy] = pointAt(startDeg);
  const [ex, ey] = pointAt(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

const BAND_COLORS: Record<HealthScore["band"], string> = {
  good: "var(--green)",
  watch: "var(--amber)",
  risk: "var(--red)",
};

const BAND_LABELS: Record<HealthScore["band"], string> = {
  good: "Good — steady",
  watch: "Needs attention",
  risk: "At risk",
};

export function HealthGauge({ health }: { health: HealthScore }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = (t: number) => {
      let p = Math.min(1, (t - start) / DURATION_MS);
      p = 1 - Math.pow(1 - p, 3); // cubic ease-out, like the design
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const end = START_ANGLE + SWEEP * (health.score / 100) * progress;
  const displayed = Math.round(health.score * progress);
  const color = BAND_COLORS[health.band];

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={200} height={168} viewBox="0 0 200 168" role="img" aria-label={`Health score ${health.score}`}>
        <path
          d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
          stroke="var(--border)"
          strokeWidth={13}
          fill="none"
          strokeLinecap="round"
        />
        {end > START_ANGLE + 0.5 && (
          <path
            d={arcPath(START_ANGLE, end)}
            stroke={color}
            strokeWidth={13}
            fill="none"
            strokeLinecap="round"
          />
        )}
        <text
          x={CENTER}
          y={106}
          textAnchor="middle"
          style={{ font: "800 44px var(--font-jakarta)", fill: "var(--ink)" }}
        >
          {displayed}
        </text>
        <text
          x={CENTER}
          y={128}
          textAnchor="middle"
          style={{
            font: "700 10.5px var(--font-jakarta)",
            fill: "var(--muted-2)",
            letterSpacing: ".09em",
          }}
        >
          HEALTH SCORE
        </text>
      </svg>
      <div style={{ fontWeight: 700, fontSize: 14, color }}>{BAND_LABELS[health.band]}</div>
      <p style={{ marginTop: 6, fontSize: 12.5, color: "var(--muted)" }}>{health.summary}</p>
    </div>
  );
}
