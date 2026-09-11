import React from "react";
import { cn } from "@/lib/utils";

export interface PanelFooterProps {
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function PanelFooter({
  primaryAction,
  secondaryAction,
  note,
  className,
  style,
  children,
}: PanelFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 border-t border-[#1C2A38] bg-[#0A0E14]/90 flex-shrink-0 select-none",
        className
      )}
      style={style}
    >
      {primaryAction || secondaryAction ? (
        <div className="flex items-center gap-2 w-full">
          {secondaryAction && <div className="flex-1">{secondaryAction}</div>}
          {primaryAction && <div className="flex-1">{primaryAction}</div>}
        </div>
      ) : null}

      {children}

      {note && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#3A5268",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
