import React, { useState } from 'react';
import { 
  Map as MapIcon, 
  TrendingUp, 
  FileText, 
  HelpCircle, 
  Sun, 
  Moon, 
  Box,
  Layers,
  Radio,
  ShieldAlert,
  Ship
} from 'lucide-react';
import { useMission } from '@/lib/mission/missionState';

export interface LeftSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenMission?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab = 'maps',
  onTabChange,
  onOpenMission,
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { state } = useMission();

  const handleSelect = (tab: string) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  const navItems = [
    { id: 'maps', label: 'Maps', icon: MapIcon },
    { id: 'tracking', label: 'Tracking List', icon: Ship },
    { id: 'expenditure', label: 'Expenditure', icon: TrendingUp },
    { id: 'documentation', label: 'Documentation', icon: FileText },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  return (
    <aside
      style={{
        width: 220,
        height: '100vh',
        backgroundColor: '#0A0D14',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 14px',
        boxSizing: 'border-box',
        zIndex: 40,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Top Section: Logo & Navigation */}
      <div>
        {/* Brand Logo */}
        <div
          onClick={() => handleSelect('maps')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 6,
            marginBottom: 28,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.15)',
            }}
          >
            <Box size={18} color="#38BDF8" strokeWidth={2.2} />
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            Pellentesque
          </span>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: isActive
                    ? '1px solid rgba(56, 189, 248, 0.35)'
                    : '1px solid transparent',
                  backgroundColor: isActive
                    ? 'rgba(29, 140, 248, 0.12)'
                    : 'transparent',
                  color: isActive ? '#38BDF8' : '#8A99AD',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 0 14px rgba(29, 140, 248, 0.12)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = '#E2E8F0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#8A99AD';
                  }
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Incident Status Pill */}
        <div
          onClick={onOpenMission}
          style={{
            marginTop: 24,
            padding: '12px 14px',
            backgroundColor: 'rgba(18, 24, 38, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: state.currentStage === 'STANDBY' ? '#94A3B8' : '#10B981',
                boxShadow: state.currentStage === 'STANDBY' ? 'none' : '0 0 8px #10B981',
                animation: state.currentStage === 'STANDBY' ? 'none' : 'standby-dot-pulse 1.8s infinite',
              }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                color: '#38BDF8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {state.currentStage}
            </span>
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94A3B8' }}>
            Mumbai Offshore Corridor
          </div>
        </div>
      </div>

      {/* Bottom Section: Theme Switcher & User Profile */}
      <div>
        {/* Light / Dark Mode Toggle Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#121622',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 9999,
            padding: 3,
            marginBottom: 16,
            gap: 2,
          }}
        >
          <button
            onClick={() => setIsDarkMode(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: !isDarkMode ? '#222E42' : 'transparent',
              color: !isDarkMode ? '#F8FAFC' : '#64748B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Light Mode"
          >
            <Sun size={13} />
          </button>
          <button
            onClick={() => setIsDarkMode(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isDarkMode ? '#222E42' : 'transparent',
              color: isDarkMode ? '#38BDF8' : '#64748B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Dark Mode"
          >
            <Moon size={13} />
          </button>
        </div>

        {/* User Profile Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80"
            alt="Kofi Agbavor"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1.5px solid rgba(56, 189, 248, 0.4)',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                fontWeight: 600,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Kofi Agbavor
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10.5,
                color: '#64748B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              kofiagbavor@gmail.com
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default LeftSidebar;
