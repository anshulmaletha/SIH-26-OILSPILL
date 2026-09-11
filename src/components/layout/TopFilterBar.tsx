import React, { useState } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { Compass, Play, RotateCcw, FastForward } from 'lucide-react';

export type VesselFilterType = 'all' | 'sailing' | 'docked' | 'anchored';

export interface TopFilterBarProps {
  activeFilter?: VesselFilterType;
  onFilterChange?: (filter: VesselFilterType) => void;
  onTriggerMission?: () => void;
}

export const TopFilterBar: React.FC<TopFilterBarProps> = ({
  activeFilter = 'all',
  onFilterChange,
  onTriggerMission,
}) => {
  const [selected, setSelected] = useState<VesselFilterType>(activeFilter);
  const { state, dispatch } = useMission();

  const handleSelect = (filter: VesselFilterType) => {
    setSelected(filter);
    onFilterChange?.(filter);
  };

  const filters: { id: VesselFilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'sailing', label: 'Sailing' },
    { id: 'docked', label: 'Docked' },
    { id: 'anchored', label: 'Anchored' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'auto',
      }}
    >
      {/* Pill Filter Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(15, 20, 30, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 9999,
          padding: '4px 6px',
          gap: 4,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {filters.map((f) => {
          const isSelected = selected === f.id;
          return (
            <button
              key={f.id}
              onClick={() => handleSelect(f.id)}
              style={{
                border: 'none',
                background: isSelected ? '#243046' : 'transparent',
                color: isSelected ? '#FFFFFF' : '#8A99AD',
                padding: '6px 16px',
                borderRadius: 9999,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.color = '#8A99AD';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Mission Quick Play HUD (Subtle Pill on map) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(15, 20, 30, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 9999,
          padding: '4px 10px',
          gap: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <button
          onClick={() => dispatch({ type: 'TOGGLE_AUTOPLAY' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: state.autoPlay ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
            border: state.autoPlay ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
            color: state.autoPlay ? '#38BDF8' : '#8A99AD',
            padding: '5px 12px',
            borderRadius: 9999,
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            fontSize: 11.5,
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          <Play size={11} fill={state.autoPlay ? '#38BDF8' : 'none'} />
          <span>{state.autoPlay ? 'AUTO PLAYING' : 'PLAY MISSION'}</span>
        </button>

        <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Speed button */}
        <button
          onClick={() => {
            const nextSpeed = state.playbackSpeed === 1 ? 2 : state.playbackSpeed === 2 ? 4 : 1;
            dispatch({ type: 'SET_SPEED', speed: nextSpeed });
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#38BDF8',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: 4,
          }}
          title="Playback speed"
        >
          {state.playbackSpeed}×
        </button>
      </div>
    </div>
  );
};

export default TopFilterBar;
