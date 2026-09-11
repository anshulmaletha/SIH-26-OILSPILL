import React from "react";
import { cn } from "@/lib/utils";

export type TelemetryLevel = "info" | "ok" | "warn" | "crit" | "data" | "critical" | "success" | "lock";

export interface TelemetryEventProps {
  timestamp: string;
  level: TelemetryLevel;
  message: string;
  isLast?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function TelemetryEvent({
  timestamp,
  level,
  message,
  isLast = false,
  className,
  style,
}: TelemetryEventProps) {
  const levelColors: Record<TelemetryLevel, { chip: string; text: string }> = {
    info: { chip: "bg-[#22D3EE]/15 text-[#22D3EE] border-[#22D3EE]/30", text: "#C8D8E8" },
    ok: { chip: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30", text: "#10B981" },
    warn: { chip: "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40", text: "#F59E0B" },
    crit: { chip: "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40", text: "#EF4444" },
    critical: { chip: "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40", text: "#EF4444" },
    data: { chip: "bg-[#5A7A94]/20 text-[#C8D8E8] border-[#5A7A94]/40", text: "#C8D8E8" },
    success: { chip: "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40", text: "#10B981" },
    lock: { chip: "bg-[#EF4444]/25 text-[#EF4444] border-[#EF4444]/60", text: "#E2E8F0" },
  };

  const currentLevel = levelColors[level] ?? levelColors["info"];

  return (
    <div
      className={cn(
        "flex items-start gap-2 py-0.5 leading-relaxed font-mono select-text",
        className
      )}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "9px",
        ...style,
      }}
    >
      {/* Timestamp */}
      <span
        style={{
          color: "#3A5268",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {timestamp}
      </span>

      {/* Level Tag */}
      <span
        className={cn(
          "px-1 py-0.5 rounded-xs border text-[7px] font-bold uppercase tracking-wider flex-shrink-0",
          currentLevel.chip
        )}
      >
        {level}
      </span>

      {/* Message */}
      <span
        style={{
          color: currentLevel.text,
          wordBreak: "break-word",
          flex: 1,
        }}
      >
        {message}
        {isLast && (
          <span
            className="inline-block w-1.5 h-3 ml-1 bg-[#22D3EE] align-middle animate-pulse"
            style={{ animationDuration: "0.9s" }}
          />
        )}
      </span>
    </div>
  );
}
