import React, { useState, useEffect } from 'react';
import { getLoads, getColours, getDashboardAnalytics } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, TreePine, Truck, Clock,
  RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Calendar, MapPin, ArrowRight, BarChart3, TrendingUp, Building2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

const COLOR_MAP = {
  green: '#16a34a', blue: '#2563eb', silver: '#6b7280',
  red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [loadsRes, coloursRes, analyticsRes] = await Promise.all([
        getLoads(), getColours(), getDashboardAnalytics()
      ]);
      setLoads(loadsRes.data);
      setColours(coloursRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to fetch', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getStockForColour = (color) => colours.find(c => c.color === color?.toLowerCase())?.quantity || 0;
  const totalStock = colours.reduce((sum, c) => sum + (c.quantity || 0), 0);

  const upcomingCollections = loads
    .filter(l => l.status === 'loading')
    .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''));

  const stockRequired = {};
  upcomingCollections.forEach(load => {
    (load.pallets_required || []).forEach(p => {
      const color = p.color?.toLowerCase();
      if (!color) return;
      if (!stockRequired[color]) stockRequired[color] = 0;
      stockRequired[color] += p.quantity;
    });
  });

  const fulfillmentSummary = Object.entries(stockRequired).map(([color, needed]) => {
    const available = getStockForColour(color);
    const shortfall = Math.max(0, needed - available);
    return { color, needed, available, shortfall, ok: shortfall === 0 };
  });

  const allFulfilled = fulfillmentSummary.every(f => f.ok);
  const totalNeeded = fulfillmentSummary.reduce((sum, f) => sum + f.needed, 0);
  const totalShortfall = fulfillmentSummary.reduce((sum, f) => sum + f.shortfall, 0);

  const checkCollectionFulfillment = (pallets_required) => {
    if (!pallets_required?.length) return 'none';
    for (const p of pallets_required) { if (getStockForColour(p.color) < p.quantity) return 'need_more'; }
    return 'can_fulfill';
  };

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
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="stats-grid">
            <div className="stat-card cursor-pointer" onClick={() => navigate('/pallets')}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#4A5D53]">In Stock</span>
                <Package className="w-3.5 h-3.5 text-[#1A4331]" />
              </div>
              <p className="text-xl font-bold text-[#0A1711] font-['Outfit']">{totalStock}</p>
              <p className="text-[10px] text-[#4A5D53]">{(totalStock * 100).toLocaleString()} trees</p>
            </div>
            <div className="stat-card cursor-pointer" onClick={() => navigate('/loads')}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#4A5D53]">Required</span>
                <TreePine className="w-3.5 h-3.5 text-[#E27B58]" />
              </div>
              <p className="text-xl font-bold text-[#0A1711] font-['Outfit']">{totalNeeded}</p>
              <p className="text-[10px] text-[#4A5D53]">for {upcomingCollections.length} collections</p>
            </div>
            <div className="stat-card cursor-pointer" onClick={() => navigate('/pallets')}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#4A5D53]">Status</span>
                {allFulfilled ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
              </div>
              <p className={`text-base font-bold font-['Outfit'] ${allFulfilled ? 'text-emerald-700' : 'text-amber-700'}`}>
                {fulfillmentSummary.length === 0 ? 'No Orders' : allFulfilled ? 'All Covered' : `Need ${totalShortfall}`}
              </p>
              <p className="text-[10px] text-[#4A5D53]">{allFulfilled ? 'stock OK' : 'from field'}</p>
            </div>
            <div className="stat-card cursor-pointer" onClick={() => navigate('/loads')}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#4A5D53]">Upcoming</span>
                <Truck className="w-3.5 h-3.5 text-[#1A4331]" />
              </div>
              <p className="text-xl font-bold text-[#0A1711] font-['Outfit']">{upcomingCollections.length}</p>
              <p className="text-[10px] text-[#4A5D53]">collections</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#4A5D53]">Avg Yard Time</span>
                <Clock className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-[#0A1711] font-['Outfit']">{analytics?.avg_yard_days || 0}</p>
              <p className="text-[10px] text-[#4A5D53]">days per pallet</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#4A5D53]">Total Moved</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-[#0A1711] font-['Outfit']">{analytics?.total_out || 0}</p>
              <p className="text-[10px] text-[#4A5D53]">{((analytics?.total_out || 0) * 100).toLocaleString()} trees dispatched</p>
            </div>
          </div>

          {/* Row 2: Stock fulfillment + Hauler stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Required */}
            <div className="bg-white border border-[#1A4331]/15 rounded-xl p-5" data-testid="stock-required">
              <h3 className="text-base font-semibold text-[#0A1711] font-['Outfit'] mb-3">Stock vs Required</h3>
              {fulfillmentSummary.length === 0 ? (
                <p className="text-sm text-[#4A5D53]">No upcoming collections.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-3 text-[9px] uppercase tracking-wider font-bold text-[#4A5D53] pb-1 border-b border-[#1A4331]/10">
                    <span>Colour</span><span className="text-right">Need</span><span className="text-right">Have</span><span className="text-right">Short</span><span className="text-right">Status</span>
                  </div>
                  {fulfillmentSummary.map((f) => (
                    <div key={f.color} className={`grid grid-cols-5 gap-3 items-center py-2 px-2 rounded-lg text-sm ${f.ok ? 'bg-emerald-50/50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_MAP[f.color] || '#1A4331' }} />
                        <span className="font-semibold capitalize text-xs">{f.color}</span>
                      </div>
                      <span className="text-right font-bold text-xs">{f.needed}</span>
                      <span className="text-right text-xs">{f.available}</span>
                      <span className={`text-right font-bold text-xs ${f.shortfall > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{f.shortfall > 0 ? `-${f.shortfall}` : '0'}</span>
                      <div className="flex justify-end">
                        {f.ok ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hauler Stats */}
            <div className="bg-white border border-[#1A4331]/15 rounded-xl p-5" data-testid="hauler-stats">
              <h3 className="text-base font-semibold text-[#0A1711] font-['Outfit'] mb-3">Loads by Hauler</h3>
              {(!analytics?.hauler_stats?.length) ? (
                <p className="text-sm text-[#4A5D53]">No dispatch data yet.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.hauler_stats.map((h, i) => {
                    const maxLoads = Math.max(...analytics.hauler_stats.map(x => x.loads));
                    const pct = maxLoads > 0 ? (h.loads / maxLoads) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Building2 className="w-3.5 h-3.5 text-[#4A5D53] flex-shrink-0" />
                          <span className="text-xs font-medium text-[#0A1711] truncate">{h.hauler}</span>
                        </div>
                        <div className="w-32 h-4 bg-[#F4F1ED] rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full bg-[#1A4331] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-right flex-shrink-0 w-20">
                          <span className="text-xs font-bold text-[#0A1711]">{h.loads}</span>
                          <span className="text-[10px] text-[#4A5D53] ml-1">({h.pallets}p)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Activity chart + Colour demand */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 14-day activity chart */}
            <div className="lg:col-span-2 bg-white border border-[#1A4331]/15 rounded-xl p-5" data-testid="activity-chart">
              <h3 className="text-base font-semibold text-[#0A1711] font-['Outfit'] mb-3">14-Day Activity</h3>
              {analytics?.daily_movements?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.daily_movements} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,67,49,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4A5D53' }} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: '#4A5D53' }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="in" name="Pallets In" fill="#16a34a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="out" name="Pallets Out" fill="#E27B58" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-[#4A5D53]">No activity data yet</div>
              )}
            </div>

            {/* Colour demand */}
            <div className="bg-white border border-[#1A4331]/15 rounded-xl p-5" data-testid="colour-demand">
              <h3 className="text-base font-semibold text-[#0A1711] font-['Outfit'] mb-3">Colour Demand</h3>
              {(!analytics?.colour_demand?.length) ? (
                <p className="text-sm text-[#4A5D53]">No demand data yet.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.colour_demand.map((c, i) => {
                    const maxDemand = Math.max(...analytics.colour_demand.map(x => x.total));
                    const pct = maxDemand > 0 ? (c.total / maxDemand) * 100 : 0;
                    const stock = getStockForColour(c.color);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_MAP[c.color] || '#1A4331' }} />
                            <span className="text-xs font-semibold capitalize">{c.color}</span>
                          </div>
                          <span className="text-xs text-[#4A5D53]">{c.total} ordered &middot; {stock} in stock</span>
                        </div>
                        <div className="w-full h-3 bg-[#F4F1ED] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLOR_MAP[c.color] || '#1A4331' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Scheduled Collections */}
          <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="scheduled-collections">
            <div className="px-5 py-3 border-b border-[#1A4331]/10 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0A1711] font-['Outfit']">Scheduled Collections</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/loads')} className="text-[#1A4331] text-xs">
                Manage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            {upcomingCollections.length === 0 ? (
              <div className="py-10 text-center text-[#4A5D53]">
                <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No upcoming collections</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1A4331]/5">
                {upcomingCollections.slice(0, 6).map((load) => {
                  const status = checkCollectionFulfillment(load.pallets_required);
                  const dateObj = load.departure_date ? new Date(load.departure_date + 'T00:00:00') : null;
                  return (
                    <div key={load.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#F4F1ED]/30 transition-colors">
                      <div className="w-11 h-11 rounded-lg bg-[#F4F1ED] flex flex-col items-center justify-center flex-shrink-0 border border-[#1A4331]/10">
                        <span className="text-[9px] uppercase tracking-wider text-[#4A5D53] font-bold leading-none">{dateObj?.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                        <span className="text-lg font-bold text-[#0A1711] font-['Outfit'] leading-none">{dateObj?.getDate()}</span>
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${status === 'can_fulfill' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {status === 'can_fulfill' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#0A1711] truncate">{load.driver_name}</p>
                        {load.destinations?.[0] && <p className="text-[10px] text-[#4A5D53] flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-[#E27B58]" /> {load.destinations[0].address}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {(load.pallets_required || []).map((p, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${getStockForColour(p.color) >= p.quantity ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {p.quantity}x {p.color}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
