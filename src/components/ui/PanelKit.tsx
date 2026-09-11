/**
 * PanelKit — Shared UI primitives for the SIH Maritime Intelligence UI
 *
 * All side panels and overlays use these primitives for a
 * uniform, clean appearance across the entire application.
 */
import React from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const T = {
  bgBase:    '#080C14',
  bgPanel:   '#0C1220',
  bgElevated:'#111B2A',
  bgHeader:  '#0A101C',
  border:    '#1A2B3D',
  dimText:   '#3C536A',
  midText:   '#5C7A94',
  bodyText:  '#A8BDD0',
  brightText:'#EDF2F7',
  sky:       '#38BDF8',
  emerald:   '#10B981',
  amber:     '#F59E0B',
  red:       '#EF4444',
  fontMono:  "'JetBrains Mono', 'IBM Plex Mono', monospace",
  fontSans:  "'Inter', 'Space Grotesk', sans-serif",
} as const;

// ─── Panel wrapper ────────────────────────────────────────────────────────────
export interface PanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  accentColor?: string;
}

export const Panel: React.FC<PanelProps> = ({ children, style, className, accentColor }) => (
  <div
    className={className}
    style={{
      backgroundColor: T.bgPanel,
      border: `1px solid ${T.border}`,
      borderRadius: 3,
      overflow: 'hidden',
      borderLeft: accentColor ? `3px solid ${accentColor}` : `1px solid ${T.border}`,
      ...style,
    }}
  >
    {children}
  </div>
);

// ─── Panel section header ─────────────────────────────────────────────────────
export interface PanelHeaderProps {
  label: string;
  sub?: string;
  color?: string;
  live?: boolean;
  right?: React.ReactNode;
  compact?: boolean;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  label,
  sub,
  color = T.sky,
  live = false,
  right,
  compact = false,
}) => (
  <div
    style={{
      padding: compact ? '8px 12px' : '10px 14px',
      borderBottom: `1px solid ${T.border}`,
      backgroundColor: T.bgHeader,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}
  >
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {live && <LiveDot color={color} />}
        <span
          style={{
            fontFamily: T.fontSans,
            fontSize: 11,
            fontWeight: 600,
            color,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.07em',
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
      {sub && (
        <div
          style={{
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.midText,
            marginTop: 3,
            lineHeight: 1,
          }}
        >
          {sub}
        </div>
      )}
    </div>
    {right && <div style={{ flexShrink: 0 }}>{right}</div>}
  </div>
);

// ─── Data row (label / value) ─────────────────────────────────────────────────
export interface DataRowProps {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  mono?: boolean;
  borderBottom?: boolean;
}

export const DataRow: React.FC<DataRowProps> = ({
  label,
  value,
  valueColor = T.brightText,
  mono = true,
  borderBottom = true,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '5px 14px',
      borderBottom: borderBottom ? `1px solid ${T.border}` : 'none',
      gap: 8,
    }}
  >
    <span
      style={{
        fontFamily: T.fontSans,
        fontSize: 11,
        color: T.midText,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontFamily: mono ? T.fontMono : T.fontSans,
        fontSize: 11,
        color: valueColor,
        textAlign: 'right',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </span>
  </div>
);

// ─── Status badge ─────────────────────────────────────────────────────────────
export type BadgeStatus = 'confirmed' | 'rejected' | 'active' | 'pending' | 'finalized' | 'null' | 'custom';

export interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  color?: string;
}

const BADGE_COLORS: Record<BadgeStatus, { bg: string; border: string; text: string }> = {
  confirmed:  { bg: '#38BDF808', border: '#38BDF830', text: '#38BDF8' },
  rejected:   { bg: '#EF444408', border: '#EF444430', text: '#EF4444' },
  active:     { bg: '#38BDF808', border: '#38BDF830', text: '#38BDF8' },
  pending:    { bg: '#1A2B3D',   border: '#2A3D52',   text: '#5C7A94' },
  finalized:  { bg: '#38BDF808', border: '#38BDF830', text: '#38BDF8' },
  null:       { bg: '#F59E0B08', border: '#F59E0B30', text: '#F59E0B' },
  custom:     { bg: '#38BDF808', border: '#38BDF830', text: '#38BDF8' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, color }) => {
  const c = BADGE_COLORS[status];
  const textColor = color || c.text;
  const text = label || status.toUpperCase();
  return (
    <span
      style={{
        fontFamily: T.fontMono,
        fontSize: 9,
        fontWeight: 700,
        color: textColor,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        padding: '2px 7px',
        borderRadius: 2,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        display: 'inline-block',
      }}
    >
      {text}
    </span>
  );
};

// ─── Score bar ────────────────────────────────────────────────────────────────
export interface ScoreBarProps {
  value: number; // 0–1
  label: string;
  detail?: string;
  percent?: string;
  color?: string;
  animDelay?: number;
  visible?: boolean;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
  value,
  label,
  detail,
  percent,
  color = T.sky,
  animDelay = 0,
  visible = true,
}) => (
  <div
    style={{
      marginBottom: 10,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
      <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.bodyText }}>{label}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color }}>
        {percent ?? `${(value * 100).toFixed(1)}%`}
      </span>
    </div>
    <div style={{ height: 3, backgroundColor: '#1A2B3D', borderRadius: 0, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          backgroundColor: color,
          transformOrigin: 'left center',
          transform: `scaleX(${Math.max(0, Math.min(1, value))})`,
          transition: `transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${animDelay}ms`,
        }}
      />
    </div>
    {detail && (
      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText, marginTop: 3, lineHeight: 1.3 }}>
        {detail}
      </div>
    )}
  </div>
);

// ─── Divider ──────────────────────────────────────────────────────────────────
export const Divider: React.FC<{ color?: string; margin?: string }> = ({
  color = T.border,
  margin = '0',
}) => <div style={{ height: 1, backgroundColor: color, margin }} />;

// ─── Live dot (animated) ──────────────────────────────────────────────────────
export const LiveDot: React.FC<{ color?: string; size?: number }> = ({
  color = T.sky,
  size = 6,
}) => (
  <span
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: color,
      flexShrink: 0,
      animation: 'standby-dot-pulse 1.6s ease-in-out infinite',
    }}
  />
);

// ─── Section label ────────────────────────────────────────────────────────────
export const SectionLabel: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = T.dimText,
}) => (
  <div
    style={{
      fontFamily: T.fontSans,
      fontSize: 10,
      fontWeight: 600,
      color,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      marginBottom: 6,
    }}
  >
    {children}
  </div>
);

// ─── Big value (large display number) ────────────────────────────────────────
export const BigValue: React.FC<{ value: string; unit?: string; color?: string; size?: number }> = ({
  value,
  unit,
  color = T.brightText,
  size = 28,
}) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
    <span
      style={{
        fontFamily: T.fontMono,
        fontSize: size,
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      {value}
    </span>
    {unit && (
      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.midText }}>{unit}</span>
    )}
  </div>
);
