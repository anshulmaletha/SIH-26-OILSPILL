import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ConfidenceIndicatorProps {
  value: number; // 0 to 1 or 0 to 100
  label?: string;
  showPercent?: boolean;
  color?: "cyan" | "emerald" | "amber" | "red" | "dynamic";
  height?: number;
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ConfidenceIndicator({
  value,
  label,
  showPercent = true,
  color = "cyan",
  height = 3,
  delayMs = 0,
  className,
  style,
}: ConfidenceIndicatorProps) {
  // Normalize 0-1 to 0-100
  const pct = value <= 1 ? value * 100 : value;
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPct(Math.min(100, Math.max(0, pct)));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [pct, delayMs]);

  // Dynamic color selection based on value
  let barColor = "#22D3EE";
  if (color === "dynamic") {
    if (animatedPct >= 80) barColor = "#22D3EE";
    else if (animatedPct >= 50) barColor = "#F59E0B";
    else barColor = "#EF4444";
  } else if (color === "emerald") {
    barColor = "#10B981";
  } else if (color === "amber") {
    barColor = "#F59E0B";
  } else if (color === "red") {
    barColor = "#EF4444";
  }

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)} style={style}>
      {(label || showPercent) && (
        <div className="flex items-baseline justify-between select-none">
          {label && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8.5px",
                color: "#5A7A94",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {label}
            </span>
          )}
          {showPercent && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                fontWeight: 700,
                color: barColor,
                lineHeight: 1,
              }}
            >
              {animatedPct.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Bar track */}
      <div
        style={{
          height,
          backgroundColor: "#1C2A38",
          borderRadius: "1px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${animatedPct}%`,
            backgroundColor: barColor,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}
