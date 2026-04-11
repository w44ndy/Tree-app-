import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Package, MapPin, ClipboardList,
  Truck, BoxesIcon, LogOut, User
} from 'lucide-react';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";
import { Button } from '../components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pallets', label: 'Pallets', icon: Package },
  { path: '/yard', label: 'Yard & Stock', icon: MapPin },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/loads', label: 'Loads', icon: BoxesIcon },
  { path: '/lorries', label: 'Lorries', icon: Truck },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F1ED] flex" data-testid="app-layout">
      {/* Sidebar */}
      <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-[#1A4331]/15 flex flex-col no-print fixed h-full z-40" data-testid="sidebar">
        <div className="p-5 border-b border-[#1A4331]/10">
          <div className="flex items-center gap-3">
            <img src={WC_LOGO} alt="Wilson Contractors" className="h-9 object-contain flex-shrink-0" />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : 'text-[#4A5D53] hover:text-[#0A1711]'}`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1A4331]/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A4331]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[#1A4331]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#0A1711] truncate">{user?.name || user?.email}</p>
              <p className="text-[10px] text-[#4A5D53] uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-[#4A5D53] hover:text-red-600 hover:bg-red-50"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6 md:p-8 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
