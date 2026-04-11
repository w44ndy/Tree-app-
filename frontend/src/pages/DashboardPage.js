import React, { useState, useEffect } from 'react';
import { getDashboardStats } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, TreePine, Truck, ClipboardList, MapPin,
  TrendingUp, Camera, BarChart3, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const COLOR_MAP = {
  green: '#16a34a',
  blue: '#2563eb',
  silver: '#6b7280',
  red: '#dc2626',
  gold: '#ca8a04',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const statCards = stats ? [
    { label: 'Total Trees', value: stats.total_trees, icon: TreePine, color: '#1A4331' },
    { label: 'Pallets in Yard', value: stats.in_yard, icon: Package, color: '#286646' },
    { label: 'Pallets in Field', value: stats.in_field, icon: MapPin, color: '#4B6B50' },
    { label: 'Active Loads', value: stats.active_loads, icon: Truck, color: '#E27B58' },
    { label: 'Pending Orders', value: stats.pending_orders, icon: ClipboardList, color: '#EAB308' },
    { label: 'Lorries Available', value: `${stats.available_lorries}/${stats.total_lorries}`, icon: Truck, color: '#3B82F6' },
    { label: 'Loaded', value: stats.loaded, icon: BarChart3, color: '#6366f1' },
    { label: 'Delivered', value: stats.delivered, icon: TrendingUp, color: '#64748b' },
  ] : [];

  const chartData = stats?.stock_by_color?.map(s => ({
    name: s.color?.charAt(0).toUpperCase() + s.color?.slice(1),
    trees: s.quantity,
    pallets: s.pallets,
    fill: COLOR_MAP[s.color] || '#1A4331'
  })) || [];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-[#4A5D53] mt-1">
            Welcome back, {user?.name || 'Admin'} — Mains of Corsindae
          </p>
        </div>
        <Button
          onClick={fetchStats}
          variant="outline"
          size="sm"
          className="border-[#1A4331]/20 text-[#1A4331] hover:bg-[#1A4331]/5"
          data-testid="refresh-dashboard"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-[#1A4331]" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
            {statCards.map((card, i) => (
              <div key={i} className="stat-card" data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">
                    {card.label}
                  </span>
                  <card.icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
                <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Charts + Camera */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stock by Color Chart */}
            <div className="lg:col-span-2 bg-white border border-[#1A4331]/15 rounded-xl p-6" data-testid="stock-chart">
              <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Stock by Colour</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,67,49,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4A5D53' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#4A5D53' }} />
                    <Tooltip />
                    <Bar dataKey="trees" name="Trees" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-[#4A5D53]">
                  No stock data yet. Add pallets to see stock levels.
                </div>
              )}
            </div>

            {/* Live Camera Feed */}
            <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="camera-feed">
              <div className="px-4 py-3 border-b border-[#1A4331]/10 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#1A4331]" />
                <span className="text-sm font-semibold text-[#0A1711] font-['Outfit']">Live Camera Feed</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              <div className="aspect-video relative bg-gray-900">
                <img
                  src="https://static.prod-images.emergentagent.com/jobs/1bf62ab5-4add-4c71-a4bb-fc46b76e2d54/images/d98bd188c6f1468a626d889f1d09dc0d344e6030db5b23e9c426a006bc068c8f.png"
                  alt="CCTV Feed - Yard"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-mono">
                  CAM 01 — YARD ENTRANCE
                </div>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] text-[#4A5D53] uppercase tracking-wider">
                  Configure stream URL in settings
                </p>
              </div>
            </div>
          </div>

          {/* Pie Chart for pallets breakdown */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-[#1A4331]/15 rounded-xl p-6" data-testid="pallet-pie-chart">
                <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Pallets by Colour</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={chartData} dataKey="pallets" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white border border-[#1A4331]/15 rounded-xl p-6" data-testid="quick-summary">
                <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Quick Summary</h3>
                <div className="space-y-3">
                  {stats?.stock_by_color?.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#1A4331]/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_MAP[s.color] || '#1A4331' }} />
                        <span className="text-sm font-medium capitalize">{s.color}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-[#0A1711]">{s.quantity} trees</span>
                        <span className="text-xs text-[#4A5D53] ml-2">({s.pallets} pallets)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
