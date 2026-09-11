import React, { useState } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { T } from '@/components/ui/PanelKit';

export const StandbyScreen: React.FC = () => {
  const { state, dispatch } = useMission();
  const isStandby = state.currentStage === 'STANDBY';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(5, 8, 14, 0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isStandby ? 1 : 0,
        pointerEvents: isStandby ? 'auto' : 'none',
        transition: 'opacity 0.5s ease',
        backgroundImage: 'radial-gradient(circle, rgba(56,189,248,0.04) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      {/* Top label */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.sky,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          opacity: 0.7,
        }}
      >
        SIH 26143 — MARITIME INTELLIGENCE PLATFORM
      </div>

      {/* Center card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 52px',
          backgroundColor: 'rgba(12, 18, 32, 0.88)',
          border: `1px solid ${T.border}`,
          borderRadius: 3,
          maxWidth: 520,
          width: '90%',
        }}
      >
        {/* Incident badge */}
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.midText,
            border: `1px solid ${T.border}`,
            padding: '4px 12px',
            borderRadius: 2,
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}
        >
          INC-2026-MUM-001
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: `'Space Grotesk', 'Inter', sans-serif`,
            fontSize: 26,
            fontWeight: 300,
            color: T.brightText,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          MUMBAI OFFSHORE CORRIDOR
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: T.fontSans,
            fontSize: 12,
            color: T.midText,
            textAlign: 'center',
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          Sentinel-1A SAR Detection · OpenDrift Backtrack · AIS Attribution · Containment Ops
        </div>

        {/* Coordinates */}
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 11,
            color: T.sky,
            letterSpacing: '0.04em',
            marginBottom: 28,
          }}
        >
          19.35°N · 71.85°E · Area ~4.82 km²
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: 1, backgroundColor: T.border, marginBottom: 28 }} />

        {/* CTA button */}
        <button
          onClick={() => dispatch({ type: 'INITIATE' })}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: hovered ? 'rgba(56,189,248,0.08)' : T.bgElevated,
            border: `1px solid ${T.sky}`,
            color: T.sky,
            fontFamily: T.fontMono,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '14px 28px',
            cursor: 'pointer',
            borderRadius: 2,
            transition: 'background 0.2s ease',
            outline: 'none',
          }}
        >
          INITIATE SAR MISSION ANALYSIS
        </button>
      </div>

      {/* Bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 20,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.dimText,
          letterSpacing: '0.06em',
        }}
      >
        PyTorch U-Net · OpenDrift Physics · Explainable Attribution
      </div>

      {/* Bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.midText,
          letterSpacing: '0.08em',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: T.sky,
            display: 'inline-block',
            animation: 'standby-dot-pulse 2s ease-in-out infinite',
          }}
        />
        READY FOR MISSION
      </div>
    </div>
  );
};

export default StandbyScreen;
