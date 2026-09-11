import React, { useState } from "react";

interface CollapsibleSectionProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * CollapsibleSection — lightweight expand/collapse wrapper for technical details.
 * Primary view is always visible; children are hidden behind a toggle.
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  label,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderTop: "1px solid #1C2A38" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "7px 14px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "8.5px",
          fontWeight: 600,
          color: "#5A7A94",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "color 0.15s ease",
        }}
        className="hover:text-[#88A2BC]"
      >
        <span style={{ fontSize: "9px", lineHeight: 1 }}>{open ? "▾" : "▸"}</span>
        <span>{label}</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 10px 14px" }}>{children}</div>
      )}
    </div>
  );
};
