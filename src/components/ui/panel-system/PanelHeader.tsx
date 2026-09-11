import React from "react";
import { cn } from "@/lib/utils";

export interface PanelHeaderProps {
  category?: string;
  title: string;
  subtitle?: string;
  live?: boolean;
  statusText?: string;
  statusVariant?: "cyan" | "emerald" | "amber" | "red" | "dim";
  icon?: React.ReactNode;
  onClose?: () => void;
  onCollapse?: () => void;
  isCollapsed?: boolean;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PanelHeader({
  category,
  title,
  subtitle,
  live,
  statusText,
  statusVariant = "cyan",
  icon,
  onClose,
  onCollapse,
  isCollapsed,
  action,
  className,
  style,
}: PanelHeaderProps) {
  const statusColorMap = {
    cyan: "#22D3EE",
    emerald: "#10B981",
    amber: "#F59E0B",
    red: "#EF4444",
    dim: "#5A7A94",
  };
  const activeColor = statusColorMap[statusVariant] ?? "#22D3EE";

  return (
    <div
      className={cn(
        "flex flex-col border-b border-[#1C2A38] bg-[#0A0E14]/80 px-3.5 py-2.5 flex-shrink-0 select-none",
        className
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <div className="flex-shrink-0 text-[#22D3EE]">{icon}</div>}
          <div className="flex flex-col min-w-0">
            {category && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: activeColor,
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                {category}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#E2E8F0",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </span>

              {live && (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs bg-[#EF4444]/10 border border-[#EF4444]/30">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse"
                  />
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "7.5px",
                      fontWeight: 700,
                      color: "#EF4444",
                      letterSpacing: "0.08em",
                      lineHeight: 1,
                    }}
                  >
                    LIVE
                  </span>
                </div>
              )}

              {statusText && !live && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "8px",
                    fontWeight: 600,
                    color: activeColor,
                    backgroundColor: `${activeColor}15`,
                    border: `1px solid ${activeColor}35`,
                    padding: "1px 5px",
                    borderRadius: "1px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {statusText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {action}

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
              style={{
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid #1C2A38",
                color: "#5A7A94",
                cursor: "pointer",
                borderRadius: "2px",
                fontSize: "9px",
                padding: 0,
                transition: "all 0.15s ease",
              }}
              className="hover:border-[#22D3EE] hover:text-[#22D3EE]"
            >
              {isCollapsed ? "▼" : "▲"}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              style={{
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid #1C2A38",
                color: "#5A7A94",
                cursor: "pointer",
                borderRadius: "2px",
                fontSize: "12px",
                padding: 0,
                lineHeight: 1,
                transition: "all 0.15s ease",
              }}
              className="hover:border-[#EF4444] hover:text-[#EF4444]"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {subtitle && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8.5px",
            color: "#5A7A94",
            marginTop: "3px",
            lineHeight: 1.2,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
