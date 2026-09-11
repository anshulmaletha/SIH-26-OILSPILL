import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Plus, 
  Ship, 
  Plane, 
  Train, 
  Truck, 
  Share2, 
  FileText, 
  Compass, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Mail, 
  ExternalLink,
  X,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useMission } from '@/lib/mission/missionState';

export interface SuspiciousShipItem {
  id: string;
  code: string;
  vesselName: string;
  vesselType: string;
  status: 'HIGH SUSPICION' | 'CORRIDOR MATCH' | 'AIS BLACKOUT' | 'CLEARED' | 'IN TRANSIT';
  statusColor: string;
  carrier: string;
  carrierLogoColor: string;
  originCode: string;
  originCity: string;
  originCountry: string;
  originDate: string;
  originFlag: string;
  destCode: string;
  destCity: string;
  destCountry: string;
  destDate: string;
  destFlag: string;
  transitDuration: string;
  mode: 'ship' | 'plane' | 'truck' | 'train';
  coordinates: string;
  latLng: [number, number];
  scheduledDept: string;
  actualDept: string;
  scheduledArrival: string;
  estimatedArrival: string;
  onTheWayDuration: string;
  corridorOverlapScore: number;
  speedAnomalyScore: number;
  aisGapHours: number;
  overallScore: number;
  agentName: string;
  agentRole: string;
  caseId: string;
  cargoType: string;
  cargoVolume: string;
  slickCoverage: string;
  forensicNotes: string;
}

export interface SuspiciousVesselTrackerProps {
  onSelectVesselOnMap?: (latLng: [number, number], name: string) => void;
  onClose?: () => void;
}

export const SuspiciousVesselTracker: React.FC<SuspiciousVesselTrackerProps> = ({
  onSelectVesselOnMap,
  onClose,
}) => {
  const { state, dispatch } = useMission();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ship' | 'plane' | 'truck' | 'train'>('all');

  // Realistic suspicious vessel dataset matching the reference UI cards
  const trackingItems: SuspiciousShipItem[] = useMemo(() => [
    {
      id: 'suspect-1',
      code: 'QJ3392N5XE',
      vesselName: 'MT Godavari Pioneer (IND_TANKER_412)',
      vesselType: 'Crude Oil Tanker (VLCC)',
      status: 'HIGH SUSPICION',
      statusColor: '#EF4444',
      carrier: 'Transportation by Maersk Line & Bharat Shipping',
      carrierLogoColor: '#38BDF8',
      originCode: 'BOM',
      originCity: 'Mumbai Offshore',
      originCountry: 'India',
      originDate: 'MAY 15, 2026',
      originFlag: '🇮🇳',
      destCode: 'SIN',
      destCity: 'Jurong Port',
      destCountry: 'Singapore',
      destDate: 'MAY 28, 2026',
      destFlag: '🇸🇬',
      transitDuration: '13D',
      mode: 'ship',
      coordinates: '19.352°N, 71.853°E',
      latLng: [71.853, 19.352],
      scheduledDept: '05:45 AM',
      actualDept: '06:00 AM (SAR Detection)',
      scheduledArrival: '--',
      estimatedArrival: '03:30 PM (MAY 28)',
      onTheWayDuration: '12D 06H 10M',
      corridorOverlapScore: 0.94,
      speedAnomalyScore: 0.88,
      aisGapHours: 8.2,
      overallScore: 0.942,
      agentName: 'Haruto Sato',
      agentRole: 'Maritime Intelligence Lead',
      caseId: 'INC-2026-MUM-001',
      cargoType: 'Heavy Crude Petroleum (API ~28°)',
      cargoVolume: '18 420 BBL (~4.82 km² slick)',
      slickCoverage: '4.82 km² · Major Axis 4.21 km',
      forensicNotes: 'Vessel transited backward particle dispersion corridor with AIS transponder shutoff for 8.2 hours. Speed reduction of 4.8 knots during transit.',
    },
    {
      id: 'suspect-2',
      code: 'KM1027A9QF',
      vesselName: 'The Yealmpton Express',
      vesselType: 'Chemical / Oil Products Tanker',
      status: 'CORRIDOR MATCH',
      statusColor: '#F59E0B',
      carrier: 'OOCL Marine Logistics',
      carrierLogoColor: '#EF4444',
      originCode: 'RTM',
      originCity: 'Rotterdam',
      originCountry: 'Netherlands',
      originDate: 'AUG 28, 2025',
      originFlag: '🇳🇱',
      destCode: 'SIN',
      destCity: 'Singapore',
      destCountry: 'Singapore',
      destDate: 'SEP 15, 2025',
      destFlag: '🇸🇬',
      transitDuration: '18D',
      mode: 'ship',
      coordinates: '19.120°N, 72.100°E',
      latLng: [72.100, 19.120],
      scheduledDept: '08:00 AM',
      actualDept: '08:45 AM',
      scheduledArrival: '06:00 PM',
      estimatedArrival: '11:00 PM',
      onTheWayDuration: '17D 12H 00M',
      corridorOverlapScore: 0.62,
      speedAnomalyScore: 0.45,
      aisGapHours: 1.4,
      overallScore: 0.612,
      agentName: 'Elena Rostova',
      agentRole: 'Port Control Officer',
      caseId: 'OPS-2026-COR-002',
      cargoType: 'Refined Diesel / Gasoil',
      cargoVolume: '8 200 BBL',
      slickCoverage: '0.85 km² Peripheral',
      forensicNotes: 'Minor corridor edge overlap. AIS transponder intermittent but consistent heading alignment.',
    },
    {
      id: 'suspect-3',
      code: 'LN5580H1TD',
      vesselName: 'Dark Vessel CFAR_002',
      vesselType: 'Unidentified Radar-Only Contact',
      status: 'AIS BLACKOUT',
      statusColor: '#EF4444',
      carrier: 'Shadow Fleet / Unflagged Vessel',
      carrierLogoColor: '#94A3B8',
      originCode: 'OFF',
      originCity: 'Offshore EEZ Limit',
      originCountry: 'International',
      originDate: 'MAY 14, 2026',
      originFlag: '🏴',
      destCode: 'MUM',
      destCity: 'Mumbai High Anchorage',
      destCountry: 'India',
      destDate: 'MAY 15, 2026',
      destFlag: '🇮🇳',
      transitDuration: '24H',
      mode: 'ship',
      coordinates: '19.280°N, 71.900°E',
      latLng: [71.900, 19.280],
      scheduledDept: 'UNREPORTED',
      actualDept: '04:10 AM (CFAR Hit)',
      scheduledArrival: 'UNREPORTED',
      estimatedArrival: 'T-06h',
      onTheWayDuration: '01D 02H 15M',
      corridorOverlapScore: 0.89,
      speedAnomalyScore: 0.95,
      aisGapHours: 24.0,
      overallScore: 0.915,
      agentName: 'Commander V. Rawat',
      agentRole: 'Coast Guard Radar Intercept',
      caseId: 'CFAR-2026-DARK-002',
      cargoType: 'Suspected Sludge / Bilge Discharge',
      cargoVolume: 'Estimated 2 400 BBL',
      slickCoverage: '3.12 km² direct intersection',
      forensicNotes: 'CFAR 2D radar detection in Sentinel-1 SAR scene with complete transponder blackout. High backscatter hull signature.',
    },
    {
      id: 'suspect-4',
      code: 'ZX7704L2CP',
      vesselName: 'Aerial Patrol CG-DO-228',
      vesselType: 'Dornier 228 Maritime Recon',
      status: 'IN TRANSIT',
      statusColor: '#38BDF8',
      carrier: 'Indian Coast Guard Aviation',
      carrierLogoColor: '#10B981',
      originCode: 'BOM',
      originCity: 'Mumbai Air Station',
      originCountry: 'India',
      originDate: 'MAY 15, 2026',
      originFlag: '🇮🇳',
      destCode: 'SLK',
      destCity: 'Spill Zone Sector 1',
      destCountry: 'Offshore',
      destDate: 'MAY 15, 2026',
      destFlag: '🌊',
      transitDuration: '1H',
      mode: 'plane',
      coordinates: '19.340°N, 71.840°E',
      latLng: [71.840, 19.340],
      scheduledDept: '07:00 AM',
      actualDept: '07:12 AM',
      scheduledArrival: '07:45 AM',
      estimatedArrival: 'ON SCENE',
      onTheWayDuration: '00D 00H 45M',
      corridorOverlapScore: 0.0,
      speedAnomalyScore: 0.0,
      aisGapHours: 0.0,
      overallScore: 0.0,
      agentName: 'Flight Lt. S. Nair',
      agentRole: 'Air Reconnaissance Pilot',
      caseId: 'AIR-2026-RECON-01',
      cargoType: 'Chemical Dispersant Spray System',
      cargoVolume: 'Payload 1 200 Litres Corexit',
      slickCoverage: 'Aerial Survey in progress',
      forensicNotes: 'Visual and IR confirmation of crude oil sheen with metallic luster.',
    },
    {
      id: 'suspect-5',
      code: 'RB9016V8MS',
      vesselName: 'MV Samudra Shaktiman',
      vesselType: 'Bulk Ore Carrier',
      status: 'CLEARED',
      statusColor: '#10B981',
      carrier: 'Hapag-Lloyd Bulk Lines',
      carrierLogoColor: '#F59E0B',
      originCode: 'HKG',
      originCity: 'Hong Kong',
      originCountry: 'Hong Kong',
      originDate: 'OCT 21, 2025',
      originFlag: '🇭🇰',
      destCode: 'DXB',
      destCity: 'Dubai',
      destCountry: 'UAE',
      destDate: 'NOV 02, 2025',
      destFlag: '🇦🇪',
      transitDuration: '12D',
      mode: 'ship',
      coordinates: '18.950°N, 72.300°E',
      latLng: [72.300, 18.950],
      scheduledDept: '10:00 AM',
      actualDept: '10:15 AM',
      scheduledArrival: '04:00 PM',
      estimatedArrival: '04:00 PM',
      onTheWayDuration: '11D 20H 45M',
      corridorOverlapScore: 0.04,
      speedAnomalyScore: 0.02,
      aisGapHours: 0.0,
      overallScore: 0.038,
      agentName: 'A. Al-Mansoor',
      agentRole: 'Dubai Port Authority',
      caseId: 'CLR-2026-BULK-005',
      cargoType: 'Iron Ore Dry Bulk',
      cargoVolume: '45 000 MT',
      slickCoverage: '0 km² (Clear)',
      forensicNotes: 'Vessel path 14.8 nm outside backward advection corridor. All engine telemetry normal.',
    },
  ], []);

  const [selectedId, setSelectedId] = useState<string>(trackingItems[0]?.id || '');
  const activeItem = useMemo(() => {
    return trackingItems.find(i => i.id === selectedId) || trackingItems[0]!;
  }, [trackingItems, selectedId]);

  // Filtered list based on search and category pill
  const filteredItems = useMemo(() => {
    return trackingItems.filter(item => {
      const matchesSearch = 
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.originCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.destCity.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.mode === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [trackingItems, searchQuery, categoryFilter]);

  const handleCardClick = (item: SuspiciousShipItem) => {
    setSelectedId(item.id);
    onSelectVesselOnMap?.(item.latLng, item.vesselName);
  };

  const handleExplore = () => {
    onSelectVesselOnMap?.(activeItem.latLng, activeItem.vesselName);
    if (state.currentStage === 'STANDBY') {
      dispatch({ type: 'INITIATE' });
    }
  };

  const handleDownloadDossier = () => {
    window.open(`/api/case-file?scenario=${state.scenario}`, '_blank');
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        backgroundColor: '#090D15',
        color: '#E2E8F0',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
        overflow: 'hidden',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* ── COLUMN 1: TRACKING LIST (Width ~340px) ── */}
      <div
        style={{
          width: 340,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#090D15',
          borderRight: '1px solid rgba(255, 255, 255, 0.07)',
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.01em' }}>
              Tracking list
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: '6px',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Filter items"
              >
                <Filter size={14} />
              </button>
              <button
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: '6px',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Options"
              >
                <MoreVertical size={14} />
              </button>
            </div>
          </div>

          {/* Search Bar + Action Button */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#111622',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '6px 10px',
                gap: 8,
              }}
            >
              <Search size={14} color="#64748B" />
              <input
                type="text"
                placeholder="Order ID / MMSI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  width: '100%',
                }}
              />
            </div>

            <button
              onClick={() => {
                if (state.currentStage === 'STANDBY') {
                  dispatch({ type: 'INITIATE' });
                } else {
                  dispatch({ type: 'NEXT_STAGE' });
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#1D8CF8',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '0 12px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>New order</span>
            </button>
          </div>
        </div>

        {/* Tracking List Cards (Scrollable) */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {filteredItems.map((item) => {
            const isSelected = item.id === activeItem.id;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                style={{
                  backgroundColor: isSelected ? '#121927' : '#0E131E',
                  border: isSelected ? '1.5px solid #1D8CF8' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 10,
                  padding: '12px 14px',
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
                {/* Row 1: Code & Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {item.code}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: item.statusColor,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Row 2: Route Origin -> Icon -> Destination Line */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  {/* Origin Code Badge */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      backgroundColor: '#161D2B',
                      color: '#94A3B8',
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    {item.originCode}
                  </span>

                  {/* Connecting Transit Line + Icon */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', margin: '0 8px', position: 'relative' }}>
                    <div style={{ flex: 1, height: 1, borderTop: '1px dashed #334155' }} />
                    <div
                      style={{
                        padding: '0 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#64748B',
                      }}
                    >
                      {item.mode === 'ship' ? <Ship size={12} /> :
                       item.mode === 'plane' ? <Plane size={12} /> :
                       item.mode === 'train' ? <Train size={12} /> : <Truck size={12} />}
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          backgroundColor: '#1E293B',
                          color: '#94A3B8',
                          padding: '1px 4px',
                          borderRadius: 9999,
                        }}
                      >
                        {item.transitDuration}
                      </span>
                    </div>
                    <div style={{ flex: 1, height: 1, borderTop: '1px dashed #334155' }} />
                  </div>

                  {/* Dest Code Badge */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      backgroundColor: '#161D2B',
                      color: '#94A3B8',
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    {item.destCode}
                  </span>
                </div>

                {/* Row 3: City Labels & Dates */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B' }}>
                  <div>
                    <div style={{ color: '#CBD5E1', fontWeight: 500 }}>{item.originCity}</div>
                    <div style={{ fontSize: 9 }}>{item.originDate}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#CBD5E1', fontWeight: 500 }}>{item.destCity}</div>
                    <div style={{ fontSize: 9 }}>{item.destDate}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Floating Filter Pill Bar */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#111622',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 9999,
              padding: 3,
              gap: 2,
            }}
          >
            {[
              { id: 'all', label: 'All', icon: null },
              { id: 'plane', label: null, icon: Plane },
              { id: 'ship', label: null, icon: Ship },
              { id: 'train', label: null, icon: Train },
              { id: 'truck', label: null, icon: Truck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = categoryFilter === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setCategoryFilter(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: tab.label ? '4px 12px' : '6px 8px',
                    borderRadius: 9999,
                    border: 'none',
                    backgroundColor: isActive ? '#243046' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#64748B',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label ? tab.label : Icon ? <Icon size={13} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── COLUMN 2: DETAILED SHIP & ATTRIBUTION INSPECTOR (Width ~460px) ── */}
      <div
        className="custom-scrollbar"
        style={{
          width: 460,
          height: '100%',
          overflowY: 'auto',
          backgroundColor: '#090D15',
          padding: '24px 22px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Top Header: In Transit timestamp + Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#38BDF8' }} />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                color: '#38BDF8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              IN TRANSIT · OCT 14, 2025, 09:10 (UTC)
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Large Code Title */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: '#FFFFFF',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {activeItem.code}
            </h1>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
              {activeItem.vesselName}
            </div>
          </div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              backgroundColor: `${activeItem.statusColor}18`,
              border: `1px solid ${activeItem.statusColor}44`,
              color: activeItem.statusColor,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {activeItem.status}
          </div>
        </div>

        {/* 3D Vessel Illustration / Render Card */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#0E1420',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 12,
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Detailed Container / Tanker Ship SVG Silhouette */}
          <svg width="340" height="90" viewBox="0 0 340 90" fill="none">
            {/* Sea horizon line */}
            <line x1="10" y1="78" x2="330" y2="78" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" strokeDasharray="6 4" />

            {/* Ship Hull */}
            <path
              d="M 30,68 L 70,76 L 280,76 L 315,62 L 295,58 L 50,58 Z"
              fill="#1E293B"
              stroke="#475569"
              strokeWidth="1.5"
            />
            {/* Waterline accent */}
            <path
              d="M 70,76 L 280,76 L 305,68 L 290,70 L 60,70 Z"
              fill="#EF4444"
              opacity="0.8"
            />

            {/* Containers / Cargo Blocks */}
            <rect x="70" y="32" width="22" height="26" fill="#38BDF8" opacity="0.85" rx="1" />
            <rect x="94" y="32" width="22" height="26" fill="#0284C7" opacity="0.85" rx="1" />
            <rect x="118" y="24" width="22" height="34" fill="#38BDF8" opacity="0.9" rx="1" />
            <rect x="142" y="24" width="22" height="34" fill="#F59E0B" opacity="0.85" rx="1" />
            <rect x="166" y="28" width="22" height="30" fill="#10B981" opacity="0.85" rx="1" />
            <rect x="190" y="24" width="22" height="34" fill="#EC4899" opacity="0.85" rx="1" />
            <rect x="214" y="32" width="22" height="26" fill="#38BDF8" opacity="0.85" rx="1" />
            <rect x="238" y="36" width="20" height="22" fill="#E2E8F0" opacity="0.85" rx="1" />

            {/* Bridge / Superstructure */}
            <path
              d="M 45,58 L 45,30 L 65,30 L 65,58 Z"
              fill="#E2E8F0"
              stroke="#94A3B8"
              strokeWidth="1"
            />
            {/* Radar Mast */}
            <line x1="55" y1="30" x2="55" y2="12" stroke="#94A3B8" strokeWidth="1.5" />
            <circle cx="55" cy="12" r="2.5" fill="#38BDF8" />
            {/* Bridge Windows */}
            <rect x="47" y="34" width="16" height="4" fill="#0F172A" rx="0.5" />
          </svg>

          {/* Carrier Brand & Coordinates */}
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: activeItem.carrierLogoColor }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>
                {activeItem.carrier}
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#64748B' }}>
              {activeItem.coordinates}
            </div>
          </div>
        </div>

        {/* Dual Origin / Destination Schedule Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#0E131E',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          {/* Origin */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{activeItem.originCity}</span>
              <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: '#1E293B', color: '#94A3B8', padding: '1px 5px', borderRadius: 4 }}>
                {activeItem.originCode}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', marginBottom: 2 }}>
              <span>Scheduled</span>
              <span style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{activeItem.scheduledDept}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B' }}>
              <span>Actual</span>
              <span style={{ color: '#38BDF8', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{activeItem.actualDept}</span>
            </div>
          </div>

          <ArrowRight size={16} color="#475569" />

          {/* Destination */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{activeItem.destCity}</span>
              <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: '#1E293B', color: '#94A3B8', padding: '1px 5px', borderRadius: 4 }}>
                {activeItem.destCode}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', marginBottom: 2 }}>
              <span>Scheduled</span>
              <span style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{activeItem.scheduledArrival}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B' }}>
              <span>Estimated</span>
              <span style={{ color: '#F59E0B', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{activeItem.estimatedArrival}</span>
            </div>
          </div>
        </div>

        {/* Route Progress Bar Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>Route</span>
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#64748B' }}>
              ON THE WAY: <strong style={{ color: '#94A3B8' }}>{activeItem.onTheWayDuration}</strong>
            </span>
          </div>

          {/* Segmented Progress Bar */}
          <div style={{ display: 'flex', gap: 4, height: 5, marginBottom: 10 }}>
            <div style={{ flex: 3, backgroundColor: '#38BDF8', borderRadius: 2 }} />
            <div style={{ flex: 2, backgroundColor: '#10B981', borderRadius: 2 }} />
            <div style={{ flex: 2, backgroundColor: '#1E293B', borderRadius: 2 }} />
            <div style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: 2 }} />
          </div>

          {/* Flags & Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{activeItem.originFlag}</span>
              <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{activeItem.originCity}, {activeItem.originCountry}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{activeItem.destCity}, {activeItem.destCountry}</span>
              <span>{activeItem.destFlag}</span>
            </div>
          </div>
        </div>

        {/* Officer / Agent Profile & Attribution Metadata */}
        <div
          style={{
            backgroundColor: '#0E131E',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80"
                alt={activeItem.agentName}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{activeItem.agentName}</div>
                <div style={{ fontSize: 10.5, color: '#64748B' }}>• {activeItem.agentRole}</div>
              </div>
            </div>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38BDF8',
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Mail size={12} />
              <span>Contact</span>
            </button>
          </div>

          {/* 4-Item Telemetry Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Case ID</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#E2E8F0', fontFamily: "'JetBrains Mono', monospace" }}>{activeItem.caseId}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Overlap</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#38BDF8', fontFamily: "'JetBrains Mono', monospace" }}>
                {(activeItem.corridorOverlapScore * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>AIS Blackout</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: activeItem.aisGapHours > 2 ? '#EF4444' : '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>
                {activeItem.aisGapHours}h
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Confidence</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: activeItem.overallScore > 0.7 ? '#EF4444' : '#10B981', fontFamily: "'JetBrains Mono', monospace" }}>
                {activeItem.overallScore > 0.7 ? 'HIGH RISK' : 'CLEARED'}
              </div>
            </div>
          </div>
        </div>

        {/* Cargo Details & Slick Impact */}
        <div
          style={{
            backgroundColor: '#0E131E',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', marginBottom: 10 }}>Cargo & Slick Impact</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Cargo Payload</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{activeItem.cargoVolume}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{activeItem.cargoType}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>Slick Area</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8' }}>{activeItem.slickCoverage}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              backgroundColor: '#090D15',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 6,
              fontSize: 10.5,
              color: '#94A3B8',
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: '#E2E8F0' }}>Forensic Finding: </strong>
            {activeItem.forensicNotes}
          </div>
        </div>

        {/* Bottom Action Buttons: Explore | AI Report | Share */}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
          <button
            onClick={handleExplore}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: '#1D8CF8',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              boxShadow: '0 4px 14px rgba(29, 140, 248, 0.35)',
            }}
          >
            <Compass size={14} />
            <span>Explore</span>
          </button>

          <button
            onClick={handleDownloadDossier}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
              borderRadius: 8,
              padding: '12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={14} color="#38BDF8" />
            <span>AI Report</span>
          </button>

          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Copied Case & Vessel Link to clipboard!');
              }
            }}
            style={{
              width: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#111622',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            title="Share Case"
          >
            <Share2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuspiciousVesselTracker;
