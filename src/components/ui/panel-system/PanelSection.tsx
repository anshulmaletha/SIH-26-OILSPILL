import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface PanelSectionProps {
  title?: string;
  badge?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  borderBottom?: boolean;
  borderTop?: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function PanelSection({
  title,
  badge,
  collapsible = false,
  defaultCollapsed = false,
  borderBottom = true,
  borderTop = false,
  compact = false,
  className,
  style,
  children,
}: PanelSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        "flex flex-col",
        borderBottom && "border-b border-[#1C2A38]",
        borderTop && "border-t border-[#1C2A38]",
        className
      )}
      style={style}
    >
      {title && (
        <div
          className={cn(
            "flex items-center justify-between select-none",
            compact ? "px-2.5 py-1.5" : "px-3.5 py-2",
            collapsible && "cursor-pointer hover:bg-[#111822]/40 transition-colors"
          )}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                fontWeight: 700,
                color: "#5A7A94",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                lineHeight: 1,
              }}
            >
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {badge && <div>{badge}</div>}
            {collapsible && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "8px",
                  color: "#3A5268",
                }}
              >
                {collapsed ? "▼" : "▲"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "transition-all duration-200",
          collapsed ? "max-h-0 overflow-hidden opacity-0" : "max-h-none opacity-100",
          compact ? "p-2.5" : "p-3.5",
          title && "pt-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}
