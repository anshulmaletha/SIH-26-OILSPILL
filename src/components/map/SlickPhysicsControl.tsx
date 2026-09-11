import React, { useState, useEffect } from 'react';
import { Wind, Waves, Compass, Clock, Play, RotateCcw, Activity, Eye, Pause } from 'lucide-react';
import { DEFAULT_WIND, DEFAULT_CURRENT, calculateNetDrift, generateOrganicSlick } from '@/lib/physics/slickPhysics';

export interface SlickPhysicsControlProps {
  relativeHour: number;
  onHourChange: (hour: number | ((prev: number) => number)) => void;
  windSpeed: number;
  onWindSpeedChange: (speed: number | ((prev: number) => number)) => void;
  windHeading: number;
  onWindHeadingChange: (heading: number | ((prev: number) => number)) => void;
  currentSpeed: number;
  onCurrentSpeedChange: (speed: number | ((prev: number) => number)) => void;
  currentHeading: number;
  onCurrentHeadingChange: (heading: number | ((prev: number) => number)) => void;
}

export const SlickPhysicsControl: React.FC<SlickPhysicsControlProps> = ({
  relativeHour,
  onHourChange,
  windSpeed,
  onWindSpeedChange,
  windHeading,
  onWindHeadingChange,
  currentSpeed,
  onCurrentSpeedChange,
  currentHeading,
  onCurrentHeadingChange,
}) => {
  // Options panel open by default
  const [isExpanded, setIsExpanded] = useState(true);
  // Auto-simulation inactive by default — time remains locked at user/scenario state until user clicks Simulate
  const [isSimulating, setIsSimulating] = useState(false);

  // Compute live physics slick state
  const liveState = generateOrganicSlick(
    [71.853, 19.352],
    Math.max(-24, Math.min(24, relativeHour)),
    { speedMs: windSpeed, headingDeg: windHeading },
    { speedMs: currentSpeed, headingDeg: currentHeading }
  );

  // Methodical 60 FPS continuous time progression & environmental parameter evolution when Simulating
  useEffect(() => {
    if (!isSimulating) return;

    let animFrameId: number;
    let lastTime = performance.now();

    const animateLoop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000); // delta time in seconds
      lastTime = now;

      // Advance relative hour monotonically forward (+dt). When reaching +24h forecast, stop simulation cleanly.
      onHourChange((prev) => {
        const safePrev = Math.max(-24, Math.min(24, Number.isNaN(prev) ? 0 : prev));

        if (safePrev >= 24) {
          setIsSimulating(false);
          return 24;
        }

        const nextHour = safePrev + dt * 3.5;
        const boundedHour = Math.min(24, Math.max(-24, nextHour));

        // Methodically update ERA5 wind & HYCOM current based on the time timeline (t = -24 to +24)
        const t = boundedHour;

        // 1. Wind speed grows methodically: 2.0 m/s at -24h -> 3.8 m/s at 0h -> 7.8 m/s at +24h
        const wSpeed = Number(Math.max(0.5, Math.min(15.0, 3.8 + 0.12 * t + 0.002 * t * t)).toFixed(1));
        onWindSpeedChange(wSpeed);

        // 2. Wind direction veers methodically: ~46° at -24h -> 65° at 0h -> 84° at +24h
        const wHeading = Math.round((65 + 0.8 * t + 360) % 360);
        onWindHeadingChange(wHeading);

        // 3. Current velocity accelerates methodically: 0.27 m/s at -24h -> 0.42 m/s at 0h -> 0.75 m/s at +24h
        const cSpeed = Number(Math.max(0.05, Math.min(1.5, 0.42 + 0.010 * t + 0.00015 * t * t)).toFixed(2));
        onCurrentSpeedChange(cSpeed);

        // 4. Current heading rotates along shelf bathymetry: 123° at -24h -> 135° at 0h -> 147° at +24h
        const cHeading = Math.round((135 + 0.5 * t + 360) % 360);
        onCurrentHeadingChange(cHeading);

        return boundedHour;
      });

      animFrameId = requestAnimationFrame(animateLoop);
    };

    animFrameId = requestAnimationFrame(animateLoop);
    return () => cancelAnimationFrame(animFrameId);
  }, [
    isSimulating,
    onHourChange,
    onWindSpeedChange,
    onWindHeadingChange,
    onCurrentSpeedChange,
    onCurrentHeadingChange,
  ]);

  const formattedTimeLabel =
    Math.abs(relativeHour) < 0.2
      ? 'T0 (SAR Scene)'
      : relativeHour > 0
      ? `T+${relativeHour.toFixed(1)}h (Forecast)`
      : `T${relativeHour.toFixed(1)}h (Backtrack)`;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22)',
        padding: '12px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: isExpanded ? 480 : 380,
        transition: 'width 0.2s ease',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
        color: '#0F172A',
      }}
    >
      {/* Top Bar: Time Scrubber & Quick Play */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Activity size={16} strokeWidth={2.4} />
            {isSimulating && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 6px #10B981',
                }}
              />
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              Dynamic Oil Spill Morphology
            </div>
            <div style={{ fontSize: 10, color: '#64748B' }}>
              Area: <strong style={{ color: '#0284C7' }}>{liveState.areaKm2.toFixed(2)} km²</strong> · Net Drift: <strong>{liveState.netDriftSpeedMs.toFixed(2)} m/s</strong>
            </div>
          </div>
        </div>

        {/* Play & Expand Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: isSimulating ? '#0284C7' : '#F1F5F9',
              color: isSimulating ? '#FFFFFF' : '#0F172A',
              border: 'none',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isSimulating ? <Pause size={12} fill="#FFFFFF" /> : <Play size={12} fill="currentColor" />}
            <span>{isSimulating ? 'Simulating' : 'Simulate'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: 10.5,
              fontWeight: 600,
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? 'Less' : 'Forcing ▾'}
          </button>
        </div>
      </div>

      {/* Time Step Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', marginBottom: 4 }}>
          <span>T-24h (Release)</span>
          <span style={{ fontWeight: 700, color: '#0284C7', fontFamily: "'JetBrains Mono', monospace" }}>
            {formattedTimeLabel}
          </span>
          <span>T+24h (Forecast)</span>
        </div>
        <input
          type="range"
          min={-24}
          max={24}
          step={0.1}
          value={relativeHour}
          onChange={(e) => onHourChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#0284C7', cursor: 'pointer' }}
        />
      </div>

      {/* Expanded Wind & Ocean Current Forcing Sliders */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Wind Row */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Wind size={13} color="#0284C7" />
                <span>ERA5 Surface Wind</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#0284C7' }}>
                {windSpeed.toFixed(1)} m/s @ {windHeading}°
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <span style={{ fontSize: 9.5, color: '#64748B' }}>Speed (0–15 m/s)</span>
                <input
                  type="range"
                  min={0.5}
                  max={15}
                  step={0.1}
                  value={windSpeed}
                  onChange={(e) => onWindSpeedChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284C7' }}
                />
              </div>
              <div>
                <span style={{ fontSize: 9.5, color: '#64748B' }}>Direction (0–360°)</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={windHeading}
                  onChange={(e) => onWindHeadingChange(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284C7' }}
                />
              </div>
            </div>
          </div>

          {/* Ocean Current Row */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Waves size={13} color="#10B981" />
                <span>HYCOM Ocean Current</span>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#10B981' }}>
                {currentSpeed.toFixed(2)} m/s @ {currentHeading}°
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <span style={{ fontSize: 9.5, color: '#64748B' }}>Velocity (0–1.5 m/s)</span>
                <input
                  type="range"
                  min={0.05}
                  max={1.5}
                  step={0.01}
                  value={currentSpeed}
                  onChange={(e) => onCurrentSpeedChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#10B981' }}
                />
              </div>
              <div>
                <span style={{ fontSize: 9.5, color: '#64748B' }}>Heading (0–360°)</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={currentHeading}
                  onChange={(e) => onCurrentHeadingChange(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#10B981' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlickPhysicsControl;
