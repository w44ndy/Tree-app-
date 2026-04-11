import React, { useState, useEffect } from 'react';
import { getDashboardStats, getLoads, getColours } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, TreePine, Truck, ClipboardList, Camera,
  TrendingUp, RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Calendar, Building2, MapPin, ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const COLOR_MAP = {
  green: '#16a34a', blue: '#2563eb', silver: '#6b7280',
  red: '#dc2626', gold: '#ca8a04', yellow: '#eab308',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, loadsRes, coloursRes] = await Promise.all([
        getDashboardStats(), getLoads(), getColours()
      ]);
      setStats(statsRes.data);
      setLoads(loadsRes.data);
      setColours(coloursRes.data);
    } catch (err) {
      console.error('Failed to fetch', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getStockForColour = (color) => {
    const c = colours.find(cl => cl.color === color?.toLowerCase());
    return c?.quantity || 0;
  };

  const checkFulfillment = (pallets_required) => {
    if (!pallets_required?.length) return 'none';
    let allOk = true;
    for (const p of pallets_required) {
      if (getStockForColour(p.color) < p.quantity) { allOk = false; break; }
    }
    return allOk ? 'can_fulfill' : 'need_more';
  };

  // Upcoming collections = status loading, sorted by date
  const upcomingCollections = loads
    .filter(l => l.status === 'loading')
    .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''));

  const totalStock = colours.reduce((sum, c) => sum + (c.quantity || 0), 0);

  // What do we need from the field?
  const fieldNeeds = {};
  upcomingCollections.forEach(load => {
    (load.pallets_required || []).forEach(p => {
      const color = p.color?.toLowerCase();
      if (!color) return;
      if (!fieldNeeds[color]) fieldNeeds[color] = { needed: 0, available: getStockForColour(color) };
      fieldNeeds[color].needed += p.quantity;
    });
  });
  Object.keys(fieldNeeds).forEach(color => {
    fieldNeeds[color].shortfall = Math.max(0, fieldNeeds[color].needed - fieldNeeds[color].available);
  });
  const hasShortfall = Object.values(fieldNeeds).some(f => f.shortfall > 0);

  const chartData = colours.filter(c => c.quantity > 0).map(c => ({
    name: (c.label || c.color)?.charAt(0).toUpperCase() + (c.label || c.color)?.slice(1),
    pallets: c.quantity,
    fill: COLOR_MAP[c.color] || '#1A4331'
  }));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Welcome back, {user?.name || 'Admin'} — Mains of Corsindae</p>
        </div>
        <Button onClick={fetchAll} variant="outline" size="sm" className="border-[#1A4331]/20 text-[#1A4331]" data-testid="refresh-dashboard">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-[#1A4331]" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Total Pallets</span>
                <Package className="w-4 h-4 text-[#1A4331]" />
              </div>
              <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalStock}</p>
              <p className="text-xs text-[#4A5D53]">{(totalStock * 100).toLocaleString()} trees</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Upcoming Collections</span>
                <Truck className="w-4 h-4 text-[#E27B58]" />
              </div>
              <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{upcomingCollections.length}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Ready to Go</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 font-['Outfit']">
                {upcomingCollections.filter(l => checkFulfillment(l.pallets_required) === 'can_fulfill').length}
              </p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Need From Field</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-700 font-['Outfit']">
                {upcomingCollections.filter(l => checkFulfillment(l.pallets_required) === 'need_more').length}
              </p>
            </div>
          </div>

          {/* Field Needs Alert */}
          {hasShortfall && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5" data-testid="field-needs-alert">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900 font-['Outfit']">Need From Field to Fulfill All Collections</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(fieldNeeds).filter(([_, f]) => f.shortfall > 0).map(([color, f]) => (
                  <div key={color} className="bg-white rounded-lg px-4 py-2 border border-amber-200">
                    <span className={`color-badge ${color}`}>{color}</span>
                    <span className="text-lg font-bold text-amber-900 ml-2">{f.shortfall}</span>
                    <span className="text-xs text-amber-700 ml-1">more pallets</span>
                    <span className="text-xs text-amber-500 ml-1">({f.shortfall * 100} trees)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Collections */}
          <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="upcoming-collections">
            <div className="px-6 py-4 border-b border-[#1A4331]/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit']">Upcoming Collections</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/loads')} className="text-[#1A4331]">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            {upcomingCollections.length === 0 ? (
              <div className="py-12 text-center text-[#4A5D53]">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No upcoming collections</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1A4331]/5">
                {upcomingCollections.slice(0, 5).map((load) => {
                  const status = checkFulfillment(load.pallets_required);
                  return (
                    <div key={load.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#F4F1ED]/30 transition-colors">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${status === 'can_fulfill' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          {status === 'can_fulfill' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-[#0A1711] truncate">{load.driver_name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#4A5D53] mt-0.5">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {load.departure_date}</span>
                            {load.destinations?.[0] && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {load.destinations[0].address}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                        {(load.pallets_required || []).map((p, i) => {
                          const avail = getStockForColour(p.color);
                          const ok = avail >= p.quantity;
                          return (
                            <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                              {p.quantity}x {p.color}
                              {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stock Chart + Camera */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-[#1A4331]/15 rounded-xl p-6" data-testid="stock-chart">
              <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Stock by Colour</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,67,49,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4A5D53' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#4A5D53' }} />
                    <Tooltip formatter={(val) => [`${val} pallets (${val * 100} trees)`, 'Stock']} />
                    <Bar dataKey="pallets" name="Pallets" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-[#4A5D53]">No stock data yet. Add pallets on the Stock page.</div>
              )}
            </div>
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
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-mono">CAM 01 — YARD</div>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] text-[#4A5D53] uppercase tracking-wider">Reolink feed — configure URL in settings</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
