import React from "react";
import { cn } from "@/lib/utils";
import { ConfidenceIndicator } from "./ConfidenceIndicator";

export interface AttributionFactorProps {
  shortLabel: string;
  label: string;
  displayPct: string;
  value: number; // 0 to 1
  color?: "cyan" | "emerald" | "amber" | "red";
  note?: string;
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AttributionFactor({
  shortLabel,
  label,
  displayPct,
  value,
  color = "cyan",
  note,
  delayMs = 0,
  className,
  style,
}: AttributionFactorProps) {
  const colorMap = {
    cyan: "#22D3EE",
    emerald: "#10B981",
    amber: "#F59E0B",
    red: "#EF4444",
  };
  const activeColor = colorMap[color] ?? "#22D3EE";

  return (
    <div
      className={cn("flex flex-col gap-1 py-1.5 border-b border-[#111822] last:border-b-0", className)}
      style={style}
    >
      <div className="flex items-baseline justify-between select-none">
        <div className="flex items-center gap-1.5">
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              fontWeight: 700,
              color: activeColor,
              backgroundColor: `${activeColor}15`,
              border: `1px solid ${activeColor}30`,
              padding: "0 4px",
              borderRadius: "1px",
              lineHeight: 1.3,
            }}
          >
            {shortLabel}
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "9.5px",
              color: "#C8D8E8",
            }}
          >
            {label}
          </span>
        </div>

        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10.5px",
            fontWeight: 700,
            color: activeColor,
          }}
        >
          {displayPct}
        </span>
      </div>

      <ConfidenceIndicator
        value={value}
        showPercent={false}
        color={color}
        height={2}
        delayMs={delayMs}
      />

      {note && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: color === "amber" || color === "red" ? activeColor : "#5A7A94",
            marginTop: "2px",
            lineHeight: 1.2,
          }}
        >
          {note}
        </span>
      )}
    </div>
  );
}
