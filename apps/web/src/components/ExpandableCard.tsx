"use client";

import { useState } from "react";

interface ExpandableCardProps {
  /** Always-visible content (the headline number, gauge, etc.). */
  summary: React.ReactNode;
  /** Revealed on click. Server-rendered but hidden until expanded. */
  detail: React.ReactNode;
  ariaLabel: string;
  padding?: string;
}

/** A card whose detail collapses/expands on click — turns a static stat into a drill-in. */
export function ExpandableCard({ summary, detail, ariaLabel, padding = "18px 20px" }: ExpandableCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card expandable-card" style={{ padding }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: 0,
          color: "inherit",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{summary}</div>
        <span className={`chevron${open ? " open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      <div className={`expandable-detail${open ? " open" : ""}`}>
        <div className="exp-inner">
          <div style={{ paddingTop: 13, marginTop: 13, borderTop: "1px solid var(--border)" }}>{detail}</div>
        </div>
      </div>
    </div>
  );
}
