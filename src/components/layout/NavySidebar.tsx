import React from 'react';
import { 
  Map as MapIcon, 
  Ship, 
  GitFork, 
  Settings, 
  Compass,
  Anchor
} from 'lucide-react';

export type NavTabId = 'map' | 'vessels' | 'route' | 'settings';

export interface NavySidebarProps {
  activeTab?: NavTabId;
  onTabChange?: (tab: NavTabId) => void;
}

export const NavySidebar: React.FC<NavySidebarProps> = ({
  activeTab = 'vessels',
  onTabChange,
}) => {
  const navItems: { id: NavTabId; label: string; icon: React.FC<{ size?: number; color?: string; strokeWidth?: number }> }[] = [
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'vessels', label: 'Vessels', icon: Ship },
    { id: 'route', label: 'Route planner', icon: GitFork },
  ];

  return (
    <aside
      style={{
        width: 86,
        height: '100vh',
        backgroundColor: '#072454',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 0 24px 0',
        boxSizing: 'border-box',
        zIndex: 50,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Top: Circular Crest Logo + Navigation Items */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Crest Logo */}
        <div
          onClick={() => onTabChange?.('map')}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 36,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            cursor: 'pointer',
          }}
          title="Maritime Intelligence"
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#072454',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Anchor size={18} color="#FFFFFF" strokeWidth={2.2} />
          </div>
        </div>

        {/* Nav Stack (Icon on top, Label below) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', alignItems: 'center' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                style={{
                  width: 66,
                  padding: '10px 4px',
                  borderRadius: 14,
                  border: 'none',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? '#072454' : '#8FA8D1',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? '0 4px 16px rgba(0, 0, 0, 0.22)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#8FA8D1';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon size={20} color={isActive ? '#072454' : 'currentColor'} strokeWidth={isActive ? 2.4 : 1.8} />
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10.5,
                    fontWeight: isActive ? 700 : 500,
                    lineHeight: 1.1,
                    textAlign: 'center',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom: Settings */}
      <button
        onClick={() => onTabChange?.('settings')}
        style={{
          width: 66,
          padding: '10px 4px',
          borderRadius: 14,
          border: 'none',
          backgroundColor: activeTab === 'settings' ? '#FFFFFF' : 'transparent',
          color: activeTab === 'settings' ? '#072454' : '#8FA8D1',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={(e) => {
          if (activeTab !== 'settings') {
            e.currentTarget.style.color = '#FFFFFF';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }
        }}
        onMouseLeave={(e) => {
          if (activeTab !== 'settings') {
            e.currentTarget.style.color = '#8FA8D1';
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <Settings size={20} color={activeTab === 'settings' ? '#072454' : 'currentColor'} strokeWidth={activeTab === 'settings' ? 2.4 : 1.8} />
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10.5,
            fontWeight: activeTab === 'settings' ? 700 : 500,
            lineHeight: 1.1,
          }}
        >
          Settings
        </span>
      </button>
    </aside>
  );
};

export default NavySidebar;
