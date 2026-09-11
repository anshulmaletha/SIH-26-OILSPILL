import React, { useRef, useEffect } from "react";
import { useMission } from "@/lib/mission/missionState";
import { getVisibleLogs } from "@/lib/mission/telemetryLog";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { TelemetryEvent } from "@/components/ui/panel-system/TelemetryEvent";

export const TelemetryTerminal: React.FC = () => {
  const { state } = useMission();
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = getVisibleLogs(state.currentStage, state.stageElapsedMs);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (!state.initiated) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        left: "14px",
        zIndex: 25,
        width: "280px",
        height: "160px",
        pointerEvents: "auto",
      }}
    >
      <OperationsPanel
        variant="terminal"
        borderLeftAccent
        accentColor="cyan"
        style={{
          height: "100%",
          backgroundColor: "rgba(8, 11, 15, 0.94)",
        }}
      >
        <PanelHeader
          category="SYSTEM"
          title="LIVE ACTIVITY"
          live
          style={{
            padding: "5px 10px",
            borderBottom: "1px solid #1C2A38",
            minHeight: "28px",
          }}
        />

        {/* Log stream */}
        <div
          ref={scrollRef}
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "6px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          {lines.slice(-5).map((line, idx, arr) => {
            const isLast = idx === arr.length - 1;
            return (
              <TelemetryEvent
                key={idx}
                timestamp={line.offsetLabel}
                level={line.level}
                message={line.message}
                isLast={isLast}
              />
            );
          })}

          {lines.length === 0 && (
            <div className="flex items-center gap-1 font-mono text-[9px] text-[#5A7A94]">
              <span>INITIALIZING EVENT SUBSCRIPTION STREAM…</span>
              <span className="w-1.5 h-3 bg-[#22D3EE] inline-block animate-pulse" />
            </div>
          )}
        </div>
      </OperationsPanel>
    </div>
  );
};

export default TelemetryTerminal;
