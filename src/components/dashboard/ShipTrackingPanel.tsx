import React, { useState, useMemo } from 'react';
import { Search, Plus, Ship, Compass, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useMission } from '@/lib/mission/missionState';
import type { SwarmVessel } from '@/lib/mission/swarmData';

export interface ShipTrackingPanelProps {
  swarmVessels?: SwarmVessel[];
  selectedVesselId?: string;
  onSelectVessel?: (vessel: SwarmVessel) => void;
  onAddShipClick?: () => void;
}

// Carrier brand badges inspired by screenshot
const CARRIER_BADGES: Record<string, { label: string; bg: string; text: string; logoColor: string }> = {
  MAERSK: { label: 'MAERSK', bg: 'rgba(56, 189, 248, 0.12)', text: '#38BDF8', logoColor: '#38BDF8' },
  OOCL: { label: 'OOCL', bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444', logoColor: '#EF4444' },
  HAPAG: { label: 'Hapag-Lloyd', bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', logoColor: '#F59E0B' },
  ONE: { label: 'ONE', bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899', logoColor: '#EC4899' },
  IND: { label: 'IND TANKER', bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', logoColor: '#10B981' },
  DARK: { label: 'SAR RADAR', bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444', logoColor: '#EF4444' },
};

export const ShipTrackingPanel: React.FC<ShipTrackingPanelProps> = ({
  swarmVessels = [],
  selectedVesselId,
  onSelectVessel,
  onAddShipClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { state, dispatch } = useMission();

  // Curated demo vessels matching the screenshot aesthetic & backend data
  const defaultShips = useMemo(() => [
    {
      id: 'ship-1',
      name: 'Emma Maersk',
      typeLabel: 'Tanker',
      dateStr: 'Jan 4',
      etaText: 'ETA to Tema port',
      status: 'Docked',
      carrierKey: 'MAERSK',
      vesselNumber: '#23423-353',
      route: ['Shenzhen', 'Guangzhou', 'Xiamen', 'Ningbo', 'Shanghai', 'Qingdao', 'Tianjin', 'Tema'],
      position: [71.85, 19.35] as [number, number],
      speedKnots: 11.2,
      heading: 142,
      mmsi: '419000101',
      flag: 'India',
    },
    {
      id: 'ship-2',
      name: 'The Yealmpton',
      typeLabel: 'Tanker',
      dateStr: 'Jan 7',
      etaText: 'ETA to Tema port',
      status: 'Docked',
      carrierKey: 'OOCL',
      vesselNumber: '#23423-353',
      route: ['Shenzhen', 'Guangzhou', 'Xiamen', 'Ningbo', 'Shanghai', 'Qingdao', 'Tianjin', 'Tema'],
      position: [72.10, 19.12] as [number, number],
      speedKnots: 13.8,
      heading: 185,
      mmsi: '419000202',
      flag: 'Panama',
    },
    {
      id: 'ship-3',
      name: 'Isabella',
      typeLabel: 'Tanker',
      dateStr: 'Jan 4',
      etaText: 'ETA to Tema port',
      status: 'Docked',
      carrierKey: 'HAPAG',
      vesselNumber: '#23423-353',
      route: ['Shenzhen', 'Guangzhou', 'Xiamen', 'Ningbo', 'Shanghai', 'Qingdao', 'Tianjin', 'Tema'],
      position: [71.45, 19.55] as [number, number],
      speedKnots: 10.4,
      heading: 210,
      mmsi: '419000303',
      flag: 'Liberia',
    },
    {
      id: 'ship-4',
      name: 'NYK Bird-class',
      typeLabel: 'Tanker',
      dateStr: 'Jan 4',
      etaText: 'ETA to Tema port',
      status: 'Docked',
      carrierKey: 'ONE',
      vesselNumber: '#23423-353',
      route: ['Shenzhen', 'Guangzhou', 'Xiamen', 'Ningbo', 'Shanghai', 'Qingdao', 'Tianjin', 'Tema'],
      position: [71.95, 19.05] as [number, number],
      speedKnots: 14.1,
      heading: 95,
      mmsi: '419000404',
      flag: 'Singapore',
    },
    {
      id: 'ship-5',
      name: 'IND_TANKER_412',
      typeLabel: 'Crude Oil Tanker',
      dateStr: 'May 15',
      etaText: 'Corridor Overlap (94%)',
      status: 'Attributed Culprit',
      carrierKey: 'IND',
      vesselNumber: '#419000101',
      route: ['Kandla', 'Mumbai High', 'Incident Corridor', 'JNPT', 'Colombo', 'Singapore'],
      position: [71.853, 19.352] as [number, number],
      speedKnots: 9.6,
      heading: 135,
      mmsi: '419000101',
      flag: 'India',
    },
  ], []);

  // Filter ships by query
  const filteredShips = defaultShips.filter((ship) => {
    const q = searchQuery.toLowerCase();
    return (
      ship.name.toLowerCase().includes(q) ||
      ship.vesselNumber.toLowerCase().includes(q) ||
      ship.typeLabel.toLowerCase().includes(q)
    );
  });

  return (
    <aside
      style={{
        width: 410,
        height: '100vh',
        backgroundColor: '#0A0D14',
        borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        zIndex: 35,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Top Header Section */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        {/* Title + Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Ships you are tracking
          </h2>

          <button
            onClick={() => {
              if (onAddShipClick) {
                onAddShipClick();
              } else {
                dispatch({ type: 'NEXT_STAGE' });
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#1D8CF8',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              boxShadow: '0 4px 14px rgba(29, 140, 248, 0.35)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1676D6')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1D8CF8')}
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add new ship</span>
          </button>
        </div>

        {/* Subtitle description */}
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11,
            color: '#8A99AD',
            lineHeight: 1.45,
            margin: '0 0 16px 0',
          }}
        >
          You can only track and view ships that have granted you access. Search ships by entering their vessel number, company or vessel name.
        </p>

        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#111622',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: '8px 12px',
            gap: 10,
          }}
        >
          <Search size={15} color="#64748B" />
          <input
            type="text"
            placeholder="Search ships you are tracking"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Ships List (Scrollable) */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {filteredShips.map((ship) => {
          const isSelected = selectedVesselId === ship.id || (ship.id === 'ship-3' && !selectedVesselId);
          const carrier = CARRIER_BADGES[ship.carrierKey] || CARRIER_BADGES.MAERSK;

          return (
            <div
              key={ship.id}
              onClick={() => {
                const targetVessel: any = {
                  id: ship.id,
                  name: ship.name,
                  mmsi: ship.mmsi,
                  callsign: 'VT982',
                  flag: ship.flag,
                  vesselType: 'tanker',
                  typeLabel: ship.typeLabel,
                  position: ship.position,
                  heading: ship.heading,
                  course: ship.heading,
                  speedKnots: ship.speedKnots,
                  navStatus: ship.status,
                  destination: 'Tema',
                  eta: ship.etaText,
                  lastSeen: '06:00 UTC',
                  lengthMeters: 220,
                  beamMeters: 32,
                  draughtMeters: 10.5,
                  trajectory: [ship.position],
                  isCandidate: true,
                  suspicionLevel: ship.carrierKey === 'IND' ? 'high' : 'low',
                };
                onSelectVessel?.(targetVessel);
              }}
              style={{
                backgroundColor: isSelected ? '#121927' : '#0E131E',
                border: isSelected ? '1.5px solid #1D8CF8' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 8,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 0 16px rgba(29, 140, 248, 0.18)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#111824';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#0E131E';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                }
              }}
            >
              {/* Row 1: Name + Type & Carrier Badge + ID */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#FFFFFF',
                      }}
                    >
                      {ship.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 10,
                        color: '#64748B',
                      }}
                    >
                      {ship.typeLabel}
                    </span>
                  </div>
                </div>

                {/* Carrier Badge & Vessel ID */}
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: carrier.bg,
                      color: carrier.text,
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      marginBottom: 2,
                    }}
                  >
                    <span>{carrier.label}</span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: '#64748B',
                    }}
                  >
                    {ship.vesselNumber}
                  </div>
                </div>
              </div>

              {/* Row 2: Date / ETA & Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94A3B8' }}>
                  {ship.dateStr}
                </span>
                <span style={{ fontSize: 9, color: '#475569' }}>•</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: '#64748B' }}>
                  {ship.etaText}
                </span>
              </div>

              {/* Status Pill */}
              <div style={{ marginBottom: 12 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: '#161E2E',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 600,
                    color: ship.status === 'Attributed Culprit' ? '#EF4444' : '#94A3B8',
                  }}
                >
                  {ship.status}
                </span>
              </div>

              {/* Row 3: Shipping Route Trail */}
              <div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 9,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 4,
                  }}
                >
                  Shipping route
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    color: '#8A99AD',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}
                >
                  {ship.route.map((port, idx) => (
                    <span key={idx}>
                      {port}
                      {idx < ship.route.length - 1 && (
                        <span style={{ color: '#475569', margin: '0 4px' }}>&gt;</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default ShipTrackingPanel;
