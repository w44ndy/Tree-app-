import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Package, MapPin,
  Truck, LogOut, User, Menu, X, TreePine
} from 'lucide-react';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";
import { Button } from '../components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/field', label: 'Field', icon: TreePine },
  { path: '/pallets', label: 'Stock', icon: Package },
  { path: '/loads', label: 'Collections', icon: Truck },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#F4F1ED]" data-testid="app-layout">
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#1A4331]/15 px-4 py-3 flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} data-testid="menu-button">
          <Menu className="w-5 h-5 text-[#0A1711]" />
        </Button>
        <img src={WC_LOGO} alt="Wilson Contractors" className="h-7 object-contain" />
        <div className="w-9" />
      </header>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur-xl border-r border-[#1A4331]/15 flex flex-col no-print z-50 transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        data-testid="sidebar"
      >
        <div className="p-5 border-b border-[#1A4331]/10 flex items-center justify-between">
          <div className="flex-1" />
          <img src={WC_LOGO} alt="Wilson Contractors" className="h-12 object-contain" />
          <div className="flex-1 flex justify-end">
            <Button variant="ghost" size="sm" onClick={closeSidebar} className="lg:hidden">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={closeSidebar}
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
      <main className="lg:ml-64 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
