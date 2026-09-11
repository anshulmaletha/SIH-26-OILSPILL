import React from "react";
import { cn } from "@/lib/utils";

export type PanelVariant = "side" | "drawer" | "floating" | "terminal" | "alert" | "compact";
export type PanelAccentColor = "cyan" | "emerald" | "amber" | "red" | "dim";

export interface OperationsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
  accentColor?: PanelAccentColor;
  showCornerBrackets?: boolean;
  borderLeftAccent?: boolean;
  glow?: boolean;
  isCollapsed?: boolean;
}

const ACCENT_COLORS: Record<PanelAccentColor, { border: string; glow: string; text: string }> = {
  cyan: {
    border: "#22D3EE",
    glow: "rgba(34, 211, 238, 0.12)",
    text: "#22D3EE",
  },
  emerald: {
    border: "#10B981",
    glow: "rgba(16, 185, 129, 0.12)",
    text: "#10B981",
  },
  amber: {
    border: "#F59E0B",
    glow: "rgba(245, 158, 11, 0.12)",
    text: "#F59E0B",
  },
  red: {
    border: "#EF4444",
    glow: "rgba(239, 68, 68, 0.15)",
    text: "#EF4444",
  },
  dim: {
    border: "#1C2A38",
    glow: "transparent",
    text: "#5A7A94",
  },
};

/** Tactical corner bracket decoration */
export function CornerBracket({
  position,
  color = "#22D3EE",
  size = 7,
  thickness = 1.5,
}: {
  position: "tl" | "tr" | "bl" | "br";
  color?: string;
  size?: number;
  thickness?: number;
}) {
  const base: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    pointerEvents: "none",
    zIndex: 10,
  };

  switch (position) {
    case "tl":
      return (
        <div style={{ ...base, top: -1, left: -1 }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: size, height: thickness, backgroundColor: color }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: thickness, height: size, backgroundColor: color }} />
        </div>
      );
    case "tr":
      return (
        <div style={{ ...base, top: -1, right: -1 }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: size, height: thickness, backgroundColor: color }} />
          <div style={{ position: "absolute", top: 0, right: 0, width: thickness, height: size, backgroundColor: color }} />
        </div>
      );
    case "bl":
      return (
        <div style={{ ...base, bottom: -1, left: -1 }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, width: size, height: thickness, backgroundColor: color }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, width: thickness, height: size, backgroundColor: color }} />
        </div>
      );
    case "br":
      return (
        <div style={{ ...base, bottom: -1, right: -1 }}>
          <div style={{ position: "absolute", bottom: 0, right: 0, width: size, height: thickness, backgroundColor: color }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: thickness, height: size, backgroundColor: color }} />
        </div>
      );
  }
}

export const OperationsPanel = React.forwardRef<HTMLDivElement, OperationsPanelProps>(
  (
    {
      variant = "side",
      accentColor = "cyan",
      showCornerBrackets = false,
      borderLeftAccent = false,
      glow = false,
      isCollapsed = false,
      className,
      style,
      children,
      ...rest
    },
    ref
  ) => {
    const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

    // Base tactical styles
    const baseStyle: React.CSSProperties = {
      backgroundColor: variant === "drawer" ? "#080B0F" : "rgba(10, 14, 20, 0.94)",
      border: `1px solid ${variant === "alert" ? accent.border : "#1C2A38"}`,
      borderLeft: borderLeftAccent ? `2px solid ${accent.border}` : undefined,
      borderRadius: "2px",
      color: "#C8D8E8",
      boxShadow: glow
        ? `0 0 16px ${accent.glow}, 0 8px 32px rgba(0,0,0,0.75)`
        : variant === "drawer" || variant === "floating"
        ? "0 10px 30px rgba(0,0,0,0.85)"
        : "0 4px 16px rgba(0,0,0,0.5)",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      overflow: isCollapsed ? "hidden" : "visible",
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn(
          "operations-panel transition-all duration-200 select-none",
          variant === "drawer" && "shadow-2xl",
          className
        )}
        style={baseStyle}
        {...rest}
      >
        {showCornerBrackets && (
          <>
            <CornerBracket position="tl" color={accent.border} />
            <CornerBracket position="tr" color={accent.border} />
            <CornerBracket position="bl" color={accent.border} />
            <CornerBracket position="br" color={accent.border} />
          </>
        )}
        {children}
      </div>
    );
  }
);

OperationsPanel.displayName = "OperationsPanel";
