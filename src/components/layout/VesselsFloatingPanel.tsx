import React, { useState, useMemo } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  Menu, 
  ChevronDown, 
  Navigation,
  Compass,
  Circle,
  ExternalLink
} from 'lucide-react';
import type { SwarmVessel } from '@/lib/mission/swarmData';

export interface VesselsFloatingPanelProps {
  swarmVessels?: SwarmVessel[];
  selectedVesselId?: string;
  onSelectVessel?: (vessel: any) => void;
  onOpenDetails?: (vessel: any) => void;
  onClose?: () => void;
}

export interface FloatingVesselItem {
  id: string;
  name: string;
  updatedText: string;
  speedText: string;
  statusType: 'active-green' | 'active-yellow' | 'dot-green' | 'dot-grey' | 'inactive-grey';
  position: [number, number];
  heading: number;
  speedKnots: number;
  mmsi: string;
  typeLabel: string;
  flag: string;
  isPrimary?: boolean;
}

export const VesselsFloatingPanel: React.FC<VesselsFloatingPanelProps> = ({
  swarmVessels = [],
  selectedVesselId,
  onSelectVessel,
  onOpenDetails,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'active' | 'name' | 'speed'>('active');

  // Curated list matching the exact screenshot items + real backend suspects
  const vesselItems: FloatingVesselItem[] = useMemo(() => [
    {
      id: 'vessel-1',
      name: 'MAYO-002',
      updatedText: 'Updated 45 seconds ago',
      speedText: '7km/h',
      statusType: 'active-green',
      position: [71.82, 19.32],
      heading: 140,
      speedKnots: 3.8,
      mmsi: '419000102',
      typeLabel: 'Patrol Vessel',
      flag: 'India',
    },
    {
      id: 'vessel-2',
      name: 'KARMIN 1131',
      updatedText: 'Updated 1 minute ago',
      speedText: '7km/h',
      statusType: 'active-yellow',
      position: [71.95, 19.45],
      heading: 210,
      speedKnots: 3.8,
      mmsi: '419000103',
      typeLabel: 'Bunker Tanker',
      flag: 'Panama',
    },
    {
      id: 'vessel-3',
      name: 'RIVERBOSS 521',
      updatedText: 'Updated 2 minutes ago',
      speedText: '7km/h',
      statusType: 'active-green',
      position: [72.10, 19.15],
      heading: 135,
      speedKnots: 3.8,
      mmsi: '419000104',
      typeLabel: 'Tug & Tow',
      flag: 'India',
    },
    {
      id: 'vessel-4',
      name: 'RIVERBOSS 414',
      updatedText: 'Updated 2 minutes ago',
      speedText: '7km/h',
      statusType: 'dot-green',
      position: [71.853, 19.352],
      heading: 135,
      speedKnots: 0,
      mmsi: '419000101',
      typeLabel: 'Attributed Tanker',
      flag: 'India',
      isPrimary: true,
    },
    {
      id: 'vessel-5',
      name: 'KARMIN 0541',
      updatedText: 'Updated 12 minutes ago',
      speedText: '7km/h',
      statusType: 'active-green',
      position: [71.70, 19.50],
      heading: 180,
      speedKnots: 3.8,
      mmsi: '419000105',
      typeLabel: 'General Cargo',
      flag: 'Liberia',
    },
    {
      id: 'vessel-6',
      name: 'KARMIN 0554',
      updatedText: 'Updated 2 hours ago',
      speedText: '7km/h',
      statusType: 'active-green',
      position: [71.60, 19.20],
      heading: 95,
      speedKnots: 3.8,
      mmsi: '419000106',
      typeLabel: 'Bulk Carrier',
      flag: 'Singapore',
    },
    {
      id: 'vessel-7',
      name: 'RIVERBOSS 638',
      updatedText: 'Updated 3 days ago',
      speedText: '7km/h',
      statusType: 'inactive-grey',
      position: [72.25, 18.90],
      heading: 45,
      speedKnots: 3.8,
      mmsi: '419000107',
      typeLabel: 'Offshore Supply',
      flag: 'India',
    },
    {
      id: 'vessel-8',
      name: 'MAYO-003',
      updatedText: 'Updated 5 days ago',
      speedText: '0km/h',
      statusType: 'inactive-grey',
      position: [72.30, 18.85],
      heading: 0,
      speedKnots: 0,
      mmsi: '419000108',
      typeLabel: 'Moored Dredger',
      flag: 'India',
    },
    {
      id: 'vessel-9',
      name: 'KARMIN 6436',
      updatedText: 'Updated 2 months ago',
      speedText: '2km/h',
      statusType: 'dot-grey',
      position: [71.50, 19.80],
      heading: 270,
      speedKnots: 1.1,
      mmsi: '419000109',
      typeLabel: 'Anchored Cargo',
      flag: 'Cyprus',
    },
  ], []);

  const [activeId, setActiveId] = useState<string>(selectedVesselId || 'vessel-4');

  const filteredVessels = useMemo(() => {
    return vesselItems.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vesselItems, searchQuery]);

  // Helper to render the circular badge
  const renderBadge = (type: FloatingVesselItem['statusType']) => {
    switch (type) {
      case 'active-green':
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {/* Arrow icon pointing left/heading */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E">
              <path d="M 6,12 L 17,6 L 14,12 L 17,18 Z" />
            </svg>
          </div>
        );
      case 'active-yellow':
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #EAB308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#EAB308">
              <path d="M 6,12 L 17,6 L 14,12 L 17,18 Z" />
            </svg>
          </div>
        );
      case 'dot-green':
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22C55E' }} />
          </div>
        );
      case 'dot-grey':
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#64748B' }} />
          </div>
        );
      case 'inactive-grey':
      default:
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748B">
              <path d="M 6,12 L 17,6 L 14,12 L 17,18 Z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 106,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      {/* ── 1. Top Map Search Bar (White rounded card) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: 250,
            height: 44,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 10,
          }}
        >
          <input
            type="text"
            placeholder="Search on the map"
            value={mapSearchQuery}
            onChange={(e) => setMapSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              color: '#1E293B',
            }}
          />
          <Search size={16} color="#64748B" />
        </div>

        {/* Filter Action Button */}
        <button
          style={{
            width: 44,
            height: 44,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: 'none',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#1E293B',
          }}
          title="Filter layers"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* ── 2. Floating Vessels Panel (White elevated rounded card) ── */}
      <div
        style={{
          width: 320,
          maxHeight: 'calc(100vh - 100px)',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        {/* Header: Title + Close button */}
        <div
          style={{
            padding: '18px 20px 12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              fontWeight: 700,
              color: '#0F172A',
              margin: 0,
            }}
          >
            Vessels
          </h2>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Search Input & Sort Dropdown Row */}
        <div
          style={{
            padding: '0 20px 14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* Search Box */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '6px 10px',
              gap: 8,
            }}
          >
            <Search size={13} color="#94A3B8" />
            <input
              type="text"
              placeholder="Type vessel name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%',
                fontFamily: "'Inter', sans-serif",
                fontSize: 11.5,
                color: '#0F172A',
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Active first</span>
            <ChevronDown size={13} />
          </div>
        </div>

        {/* Vessel List Rows (Scrollable) */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 12px 16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {filteredVessels.map((vessel) => {
            const isSelected = activeId === vessel.id;

            return (
              <div
                key={vessel.id}
                onClick={() => {
                  setActiveId(vessel.id);
                  onSelectVessel?.(vessel);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  backgroundColor: isSelected ? '#EDF5FF' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Badge Icon */}
                {renderBadge(vessel.statusType)}

                {/* Name & Update Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0F172A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {vessel.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 10.5,
                      color: '#64748B',
                      marginTop: 2,
                    }}
                  >
                    {vessel.updatedText} • {vessel.speedText}
                  </div>
                </div>

                {/* Details Button on Selected Vessel */}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails?.(vessel);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      background: 'none',
                      border: 'none',
                      color: '#0284C7',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                    title="View details"
                  >
                    <Menu size={16} strokeWidth={2.5} />
                    <span style={{ fontSize: 8.5, fontWeight: 700 }}>Details</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VesselsFloatingPanel;
