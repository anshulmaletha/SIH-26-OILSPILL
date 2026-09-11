import React from "react";
import { cn } from "@/lib/utils";

export interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  highlight?: boolean;
  color?: "cyan" | "emerald" | "amber" | "red" | "dim" | "default";
  badge?: React.ReactNode;
  subtext?: string;
  mono?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function MetricRow({
  label,
  value,
  unit,
  highlight = false,
  color = "default",
  badge,
  subtext,
  mono = true,
  className,
  style,
}: MetricRowProps) {
  const colorMap = {
    cyan: "#22D3EE",
    emerald: "#10B981",
    amber: "#F59E0B",
    red: "#EF4444",
    dim: "#5A7A94",
    default: highlight ? "#22D3EE" : "#C8D8E8",
  };

  const valColor = colorMap[color];

  return (
    <div
      className={cn("flex flex-col py-1 border-b border-[#111822]/60 last:border-b-0", className)}
      style={style}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            color: "#5A7A94",
            flexShrink: 0,
          }}
        >
          {label}
        </span>

        <div className="flex items-center gap-1.5 min-w-0 text-right">
          {badge && <div className="flex-shrink-0">{badge}</div>}
          <span
            style={{
              fontFamily: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
              fontSize: "10.5px",
              fontWeight: highlight ? 700 : 500,
              color: valColor,
              letterSpacing: mono ? "0.02em" : "normal",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value}
            {unit && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "9px",
                  color: "#5A7A94",
                  fontWeight: 400,
                  marginLeft: "3px",
                }}
              >
                {unit}
              </span>
            )}
          </span>
        </div>
      </div>

      {subtext && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#3A5268",
            marginTop: "1px",
            lineHeight: 1.2,
          }}
        >
          {subtext}
        </span>
      )}
    </div>
  );
}
