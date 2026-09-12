/**
 * SIH 26143 — Vessel Search Tool & Command Palette
 *
 * Provides real-time search across all AIS data:
 * - Search by Vessel Name (e.g. "MT IND_TANKER_412", "Chem Pioneer")
 * - Search by Vessel ID / MMSI (e.g. "419000101", "vessel-001", "cand-001")
 * - Search by IMO Number (e.g. "9482104")
 * - Search by Callsign or Flag
 *
 * Features:
 * - Instant auto-complete filtering
 * - Category filters: All, Suspects/Candidates, Dark Vessels, Tankers, Cargo
 * - Keyboard navigation (Arrow keys + Enter + Escape)
 * - Click to locate on map and inspect detailed telemetry in VesselInfoPanel
 * - Minimal Black & White monochrome aesthetic (Light & Dark theme support)
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Ship, AlertTriangle, Radio, Compass, Navigation, ArrowRight, ShieldAlert } from "lucide-react";
import { useMission } from "@/lib/mission/missionState";
import {
  indexAisVessels,
  searchAisVessels,
  type SearchableVessel,
  type VesselFilterCategory,
} from "@/lib/mission/vesselSearch";
import type { SwarmVessel } from "@/lib/mission/swarmData";
import type { VesselTrack } from "@/lib/contracts/p5";

export interface VesselSearchModalProps {
  swarmVessels?: SwarmVessel[];
  p5Tracks?: VesselTrack[];
  onSelectVessel: (vessel: SearchableVessel) => void;
}

export const VesselSearchModal: React.FC<VesselSearchModalProps> = ({
  swarmVessels = [],
  p5Tracks = [],
  onSelectVessel,
}) => {
  const { state, dispatch } = useMission();
  const isDark = state.theme === "dark";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<VesselFilterCategory>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Index all vessels from AIS dataset
  const indexedVessels = useMemo(() => {
    return indexAisVessels(swarmVessels, p5Tracks);
  }, [swarmVessels, p5Tracks]);

  // Filtered & ranked results
  const results = useMemo(() => {
    return searchAisVessels(indexedVessels, query, category);
  }, [indexedVessels, query, category]);

  // Auto-focus input when opened
  useEffect(() => {
    if (state.isSearchOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [state.isSearchOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, category]);

  // Keyboard navigation
  useEffect(() => {
    if (!state.isSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dispatch({ type: "SET_SEARCH_OPEN", open: false });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleChoose(results[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isSearchOpen, results, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Global Cmd+K / Ctrl+K shortcut listener to toggle search modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch({ type: "SET_SEARCH_OPEN", open: !state.isSearchOpen });
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [state.isSearchOpen, dispatch]);

  if (!state.isSearchOpen) return null;

  const handleChoose = (vessel: SearchableVessel) => {
    onSelectVessel(vessel);
    dispatch({ type: "SET_SEARCH_OPEN", open: false });
  };

  const categories: { id: VesselFilterCategory; label: string; count?: number }[] = [
    { id: "all", label: "ALL VESSELS", count: indexedVessels.length },
    {
      id: "suspects",
      label: "SUSPECTS / CANDIDATES",
      count: indexedVessels.filter((v) => v.isCandidate || v.suspicionLevel === "high" || v.mmsi === "419000101").length,
    },
    {
      id: "dark",
      label: "DARK TARGETS (RADAR)",
      count: indexedVessels.filter((v) => v.isDarkVessel || v.threatTag?.includes("DARK")).length,
    },
    {
      id: "tankers",
      label: "TANKERS",
      count: indexedVessels.filter((v) => v.vesselType === "tanker" || v.typeLabel.toLowerCase().includes("tanker")).length,
    },
    {
      id: "cargo",
      label: "CARGO / BULK",
      count: indexedVessels.filter((v) => v.vesselType === "container" || v.vesselType === "bulk").length,
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "70px",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        pointerEvents: "auto",
      }}
      onClick={() => dispatch({ type: "SET_SEARCH_OPEN", open: false })}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
          borderRadius: "4px",
          boxShadow: isDark
            ? "0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.5)"
            : "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: isDark ? "#F8FAFC" : "#0F172A",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Search Input Header ── */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
          }}
        >
          <Search size={18} style={{ color: isDark ? "#94A3B8" : "#64748B", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vessel by Name (e.g. IND_TANKER), MMSI (419000101), IMO, ID, or Flag…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "ui-monospace, monospace",
              color: isDark ? "#F8FAFC" : "#0F172A",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              style={{
                background: "transparent",
                border: "none",
                color: isDark ? "#94A3B8" : "#64748B",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
          <div
            style={{
              padding: "2px 6px",
              borderRadius: "3px",
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
              fontSize: "9px",
              fontFamily: "ui-monospace, monospace",
              color: isDark ? "#94A3B8" : "#64748B",
              fontWeight: 700,
            }}
          >
            ESC
          </div>
        </div>

        {/* ── Category Filters & Status Bar ── */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {categories.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "3px",
                    fontSize: "9px",
                    fontFamily: "ui-monospace, monospace",
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    border: active
                      ? `1px solid ${isDark ? "#F8FAFC" : "#0F172A"}`
                      : `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                    backgroundColor: active
                      ? isDark ? "#F8FAFC" : "#0F172A"
                      : isDark ? "#1E293B" : "#F8FAFC",
                    color: active
                      ? isDark ? "#0F172A" : "#FFFFFF"
                      : isDark ? "#94A3B8" : "#64748B",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c.label} {c.count !== undefined && <span style={{ opacity: 0.8 }}>({c.count})</span>}
                </button>
              );
            })}
          </div>

          <div
            style={{
              fontSize: "9.5px",
              fontFamily: "ui-monospace, monospace",
              color: isDark ? "#94A3B8" : "#64748B",
            }}
          >
            {results.length} {results.length === 1 ? "vessel" : "vessels"} matching
          </div>
        </div>

        {/* ── Results List ── */}
        <div
          ref={resultsContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: "440px",
            padding: "6px",
          }}
          className="custom-scrollbar"
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: "36px 16px",
                textAlign: "center",
                color: isDark ? "#94A3B8" : "#64748B",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              <Ship size={32} style={{ margin: "0 auto 12px auto", opacity: 0.4 }} />
              <div style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#F8FAFC" : "#0F172A", marginBottom: "4px" }}>
                NO VESSELS FOUND
              </div>
              <div style={{ fontSize: "10px", maxWidth: "380px", margin: "0 auto", lineHeight: 1.4 }}>
                No AIS vessel matches "{query}". Try searching by MMSI number (e.g. 419000101), ship name, or IMO.
              </div>
            </div>
          ) : (
            results.map((v, index) => {
              const isSelected = index === selectedIndex;
              const isCulprit = v.mmsi === "419000101";
              const isDarkVessel = v.isDarkVessel || v.threatTag?.includes("DARK");
              const isCandidate = v.isCandidate;

              return (
                <div
                  key={v.mmsi || v.id}
                  onClick={() => handleChoose(v)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    backgroundColor: isSelected
                      ? isDark ? "#1E293B" : "#F1F5F9"
                      : "transparent",
                    border: isSelected
                      ? `1px solid ${isDark ? "#334155" : "#CBD5E1"}`
                      : "1px solid transparent",
                    borderLeft: isCulprit || isDarkVessel
                      ? "3px solid #DC2626"
                      : isCandidate
                      ? "3px solid #D97706"
                      : isSelected
                      ? `3px solid ${isDark ? "#F8FAFC" : "#0F172A"}`
                      : "1px solid transparent",
                    transition: "all 0.1s ease",
                    marginBottom: "3px",
                  }}
                >
                  {/* Left info */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: isDark ? "#F8FAFC" : "#0F172A",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {v.name}
                      </span>

                      {/* Threat / Candidate Badges */}
                      {isCulprit && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "2px",
                            backgroundColor: isDark ? "#281216" : "#FEF2F2",
                            border: "1px solid #DC2626",
                            color: "#DC2626",
                          }}
                        >
                          PRIMARY CULPRIT
                        </span>
                      )}

                      {isDarkVessel && !isCulprit && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "2px",
                            backgroundColor: isDark ? "#281216" : "#FEF2F2",
                            border: "1px solid #DC2626",
                            color: "#DC2626",
                          }}
                        >
                          DARK VESSEL (NO AIS)
                        </span>
                      )}

                      {isCandidate && !isCulprit && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "2px",
                            backgroundColor: isDark ? "#2A2415" : "#FFFBEB",
                            border: "1px solid #D97706",
                            color: "#D97706",
                          }}
                        >
                          CORRIDOR SUSPECT
                        </span>
                      )}

                      {v.mmsi === "419000202" && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "2px",
                            backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                            border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                            color: isDark ? "#94A3B8" : "#64748B",
                          }}
                        >
                          CONTROL VESSEL
                        </span>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "9.5px",
                        fontFamily: "ui-monospace, monospace",
                        color: isDark ? "#94A3B8" : "#64748B",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        MMSI: <strong style={{ color: isDark ? "#F8FAFC" : "#0F172A" }}>{v.mmsi}</strong>
                      </span>
                      <span>•</span>
                      <span>{v.imo}</span>
                      <span>•</span>
                      <span>{v.typeLabel}</span>
                      <span>•</span>
                      <span>{v.flag}</span>
                    </div>

                    {/* Telemetry line */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "9px",
                        fontFamily: "ui-monospace, monospace",
                        color: isDark ? "#94A3B8" : "#64748B",
                        marginTop: "3px",
                      }}
                    >
                      <span>SOG: <strong style={{ color: isDark ? "#F8FAFC" : "#0F172A" }}>{v.speedKnots.toFixed(1)} kn</strong></span>
                      <span>COG: <strong>{v.course}°</strong></span>
                      <span>Pos: <strong>{v.position[1].toFixed(3)}°N, {v.position[0].toFixed(3)}°E</strong></span>
                      <span>Status: <span style={{ color: isDarkVessel ? "#DC2626" : (isDark ? "#F8FAFC" : "#0F172A") }}>{v.navStatus}</span></span>
                    </div>
                  </div>

                  {/* Action pill */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "9.5px",
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: "3px",
                      backgroundColor: isSelected
                        ? isDark ? "#F8FAFC" : "#0F172A"
                        : isDark ? "#1E293B" : "#F8FAFC",
                      color: isSelected
                        ? isDark ? "#0F172A" : "#FFFFFF"
                        : isDark ? "#94A3B8" : "#64748B",
                      border: `1px solid ${isSelected ? (isDark ? "#F8FAFC" : "#0F172A") : (isDark ? "#334155" : "#CBD5E1")}`,
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>LOCATE</span>
                    <ArrowRight size={11} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer Navigation Help ── */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
            backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "9px",
            fontFamily: "ui-monospace, monospace",
            color: isDark ? "#94A3B8" : "#64748B",
          }}
        >
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span>
              <kbd style={{ padding: "1px 4px", borderRadius: "2px", border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`, background: isDark ? "#0F172A" : "#FFFFFF" }}>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd style={{ padding: "1px 4px", borderRadius: "2px", border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`, background: isDark ? "#0F172A" : "#FFFFFF" }}>↵</kbd> Select & Inspect
            </span>
            <span>
              <kbd style={{ padding: "1px 4px", borderRadius: "2px", border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`, background: isDark ? "#0F172A" : "#FFFFFF" }}>ESC</kbd> Close
            </span>
          </div>
          <div>
            AIS Satellite & Radar Correlated Telemetry
          </div>
        </div>
      </div>
    </div>
  );
};

export default VesselSearchModal;
