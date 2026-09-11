import React from "react";
import { cn } from "@/lib/utils";

export interface AlertCardProps {
  severity?: "critical" | "warning" | "info";
  title: string;
  category?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  pulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function AlertCard({
  severity = "critical",
  title,
  category,
  description,
  action,
  pulse = true,
  className,
  style,
  children,
}: AlertCardProps) {
  const configs = {
    critical: {
      border: "border-[#EF4444]",
      borderLeft: "border-l-4 border-l-[#EF4444]",
      bg: "bg-[#0D1117]",
      titleColor: "text-[#EF4444]",
      dot: "bg-[#EF4444]",
      glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
    },
    warning: {
      border: "border-[#F59E0B]/60",
      borderLeft: "border-l-4 border-l-[#F59E0B]",
      bg: "bg-[#0D1117]",
      titleColor: "text-[#F59E0B]",
      dot: "bg-[#F59E0B]",
      glow: "shadow-[0_0_12px_rgba(245,158,11,0.12)]",
    },
    info: {
      border: "border-[#22D3EE]/50",
      borderLeft: "border-l-4 border-l-[#22D3EE]",
      bg: "bg-[#0D1117]",
      titleColor: "text-[#22D3EE]",
      dot: "bg-[#22D3EE]",
      glow: "shadow-[0_0_12px_rgba(34,211,238,0.12)]",
    },
  };

  const cfg = configs[severity];

  return (
    <div
      className={cn(
        "rounded-xs p-3 select-none flex flex-col gap-2 transition-all",
        cfg.bg,
        cfg.border,
        cfg.borderLeft,
        cfg.glow,
        className
      )}
      style={{
        border: "1px solid",
        borderRadius: "2px",
        ...style,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {pulse && (
            <span
              className={cn("w-2 h-2 rounded-full flex-shrink-0 animate-pulse", cfg.dot)}
            />
          )}
          <div className="flex flex-col">
            {category && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "7.5px",
                  color: "#5A7A94",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  lineHeight: 1,
                  marginBottom: "2px",
                }}
              >
                {category}
              </span>
            )}
            <span
              className={cn("font-bold uppercase tracking-wider", cfg.titleColor)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10.5px",
                letterSpacing: "0.08em",
                lineHeight: 1.2,
              }}
            >
              {title}
            </span>
          </div>
        </div>

        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {description && (
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "9.5px",
            color: "#C8D8E8",
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}

      {children}
    </div>
  );
}
