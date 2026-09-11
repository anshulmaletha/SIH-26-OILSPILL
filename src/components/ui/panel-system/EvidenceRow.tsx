import React from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

export interface EvidenceRowProps {
  label: string;
  value: React.ReactNode;
  verified?: boolean;
  statusText?: string;
  subvalue?: string;
  isHash?: boolean;
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function EvidenceRow({
  label,
  value,
  verified = true,
  statusText = "VERIFIED",
  subvalue,
  isHash = false,
  index,
  className,
  style,
}: EvidenceRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col py-2 border-b border-[#111822] hover:bg-[#111822]/30 px-1 transition-colors rounded-xs",
        className
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          {index !== undefined && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "7.5px",
                color: "#3A5268",
              }}
            >
              #{String(index).padStart(2, "0")}
            </span>
          )}
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "9.5px",
              color: "#5A7A94",
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>

        {verified && (
          <StatusBadge
            label={`✓ ${statusText}`}
            variant="cyan"
            size="sm"
          />
        )}
      </div>

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: isHash ? "8.5px" : "10px",
          color: "#E2E8F0",
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>

      {subvalue && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#5A7A94",
            marginTop: "2px",
          }}
        >
          {subvalue}
        </div>
      )}
    </div>
  );
}
