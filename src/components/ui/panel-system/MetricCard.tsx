import React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  variant?: "cyan" | "emerald" | "amber" | "red" | "dim";
  className?: string;
  style?: React.CSSProperties;
}

export function MetricCard({
  label,
  value,
  unit,
  sublabel,
  icon,
  variant = "cyan",
  className,
  style,
}: MetricCardProps) {
  const borderMap = {
    cyan: "border-[#22D3EE]/25 bg-[#22D3EE]/[0.03]",
    emerald: "border-[#10B981]/25 bg-[#10B981]/[0.03]",
    amber: "border-[#F59E0B]/25 bg-[#F59E0B]/[0.03]",
    red: "border-[#EF4444]/30 bg-[#EF4444]/[0.05]",
    dim: "border-[#1C2A38] bg-[#0A0E14]",
  };

  const textMap = {
    cyan: "text-[#22D3EE]",
    emerald: "text-[#10B981]",
    amber: "text-[#F59E0B]",
    red: "text-[#EF4444]",
    dim: "text-[#E2E8F0]",
  };

  return (
    <div
      className={cn(
        "flex flex-col p-2.5 rounded-xs border transition-all",
        borderMap[variant],
        className
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "7.5px",
            fontWeight: 700,
            color: "#5A7A94",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        {icon && <div className="text-[#5A7A94] text-xs">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className={cn("font-bold tracking-tight leading-none", textMap[variant])}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "20px",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              color: "#5A7A94",
              fontWeight: 500,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {sublabel && (
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "8.5px",
            color: "#5A7A94",
            marginTop: "4px",
            lineHeight: 1.2,
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}
