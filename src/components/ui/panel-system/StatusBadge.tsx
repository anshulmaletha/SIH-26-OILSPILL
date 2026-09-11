import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  label: React.ReactNode;
  variant?: "cyan" | "emerald" | "amber" | "red" | "dim";
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
  style?: React.CSSProperties;
}

export function StatusBadge({
  label,
  variant = "cyan",
  pulse = false,
  size = "sm",
  className,
  style,
}: StatusBadgeProps) {
  const colorConfig = {
    cyan: {
      color: "#22D3EE",
      border: "rgba(34, 211, 238, 0.35)",
      bg: "rgba(34, 211, 238, 0.08)",
      dot: "#22D3EE",
    },
    emerald: {
      color: "#10B981",
      border: "rgba(16, 185, 129, 0.35)",
      bg: "rgba(16, 185, 129, 0.08)",
      dot: "#10B981",
    },
    amber: {
      color: "#F59E0B",
      border: "rgba(245, 158, 11, 0.35)",
      bg: "rgba(245, 158, 11, 0.08)",
      dot: "#F59E0B",
    },
    red: {
      color: "#EF4444",
      border: "rgba(239, 68, 68, 0.4)",
      bg: "rgba(239, 68, 68, 0.1)",
      dot: "#EF4444",
    },
    dim: {
      color: "#5A7A94",
      border: "#1C2A38",
      bg: "#111822",
      dot: "#5A7A94",
    },
  };

  const cfg = colorConfig[variant] ?? colorConfig.cyan;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs select-none uppercase tracking-wider font-semibold",
        size === "sm" ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]",
        className
      )}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        lineHeight: 1,
        ...style,
      }}
    >
      {pulse && (
        <span
          className="inline-block rounded-full animate-pulse"
          style={{
            width: size === "sm" ? 4 : 5,
            height: size === "sm" ? 4 : 5,
            backgroundColor: cfg.dot,
          }}
        />
      )}
      {label}
    </span>
  );
}
