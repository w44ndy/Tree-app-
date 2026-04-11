import React, { useState, useEffect } from 'react';
import { getDashboardStats, getLoads, getColours } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, TreePine, Truck,
  RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Calendar, MapPin, ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

const COLOR_MAP = {
  green: '#16a34a', blue: '#2563eb', silver: '#6b7280',
  red: '#dc2626', gold: '#ca8a04', yellow: '#eab308',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [loadsRes, coloursRes] = await Promise.all([getLoads(), getColours()]);
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

  const totalStock = colours.reduce((sum, c) => sum + (c.quantity || 0), 0);

  // Upcoming collections (not yet dispatched)
  const upcomingCollections = loads
    .filter(l => l.status === 'loading')
    .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''));

  // Calculate total stock required across all upcoming collections
  const stockRequired = {};
  upcomingCollections.forEach(load => {
    (load.pallets_required || []).forEach(p => {
      const color = p.color?.toLowerCase();
      if (!color) return;
      if (!stockRequired[color]) stockRequired[color] = 0;
      stockRequired[color] += p.quantity;
    });
  });

  // Build fulfillment summary per colour
  const fulfillmentSummary = Object.entries(stockRequired).map(([color, needed]) => {
    const available = getStockForColour(color);
    const shortfall = Math.max(0, needed - available);
    return { color, needed, available, shortfall, ok: shortfall === 0 };
  });

  const allFulfilled = fulfillmentSummary.every(f => f.ok);
  const totalNeeded = fulfillmentSummary.reduce((sum, f) => sum + f.needed, 0);
  const totalShortfall = fulfillmentSummary.reduce((sum, f) => sum + f.shortfall, 0);

  // Check per-collection fulfillment
  const checkCollectionFulfillment = (pallets_required) => {
    if (!pallets_required?.length) return 'none';
    for (const p of pallets_required) {
      if (getStockForColour(p.color) < p.quantity) return 'need_more';
    }
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
            <div className="stat-card cursor-pointer" onClick={() => navigate('/pallets')} data-testid="stat-in-stock">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">In Stock</span>
                <Package className="w-4 h-4 text-[#1A4331]" />
              </div>
              <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalStock}</p>
              <p className="text-xs text-[#4A5D53]">{(totalStock * 100).toLocaleString()} trees</p>
            </div>
            <div className="stat-card cursor-pointer" onClick={() => navigate('/loads')} data-testid="stat-required">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Required</span>
                <TreePine className="w-4 h-4 text-[#E27B58]" />
              </div>
              <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalNeeded}</p>
              <p className="text-xs text-[#4A5D53]">pallets for {upcomingCollections.length} collection{upcomingCollections.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="stat-card cursor-pointer" onClick={() => navigate('/pallets')} data-testid="stat-status">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Status</span>
                {allFulfilled ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </div>
              <p className={`text-lg font-bold font-['Outfit'] ${allFulfilled ? 'text-emerald-700' : 'text-amber-700'}`}>
                {fulfillmentSummary.length === 0 ? 'No Orders' : allFulfilled ? 'All Covered' : `Need ${totalShortfall} More`}
              </p>
              <p className="text-xs text-[#4A5D53]">{allFulfilled ? 'Stock covers all collections' : 'from the field'}</p>
            </div>
            <div className="stat-card cursor-pointer" onClick={() => navigate('/loads')} data-testid="stat-collections">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Collections</span>
                <Truck className="w-4 h-4 text-[#1A4331]" />
              </div>
              <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{upcomingCollections.length}</p>
              <p className="text-xs text-[#4A5D53]">scheduled</p>
            </div>
          </div>

          {/* Stock Required to Fulfill */}
          <div className="bg-white border border-[#1A4331]/15 rounded-xl p-6" data-testid="stock-required">
            <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Stock Required to Fulfill Collections</h3>
            {fulfillmentSummary.length === 0 ? (
              <p className="text-sm text-[#4A5D53]">No upcoming collections — nothing required.</p>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-5 gap-4 text-[10px] uppercase tracking-wider font-bold text-[#4A5D53] pb-2 border-b border-[#1A4331]/10">
                  <span>Colour</span>
                  <span className="text-right">Required</span>
                  <span className="text-right">In Stock</span>
                  <span className="text-right">Shortfall</span>
                  <span className="text-right">Status</span>
                </div>
                {fulfillmentSummary.map((f) => (
                  <div key={f.color} className={`grid grid-cols-5 gap-4 items-center py-3 px-3 rounded-lg ${f.ok ? 'bg-emerald-50/50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_MAP[f.color] || '#1A4331' }} />
                      <span className="text-sm font-semibold capitalize">{f.color}</span>
                    </div>
                    <span className="text-right text-sm font-bold text-[#0A1711]">{f.needed}</span>
                    <span className="text-right text-sm font-medium text-[#0A1711]">{f.available}</span>
                    <span className={`text-right text-sm font-bold ${f.shortfall > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {f.shortfall > 0 ? `-${f.shortfall}` : '0'}
                    </span>
                    <div className="flex justify-end">
                      {f.ok ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" /> Need {f.shortfall}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {/* Totals row */}
                <div className="grid grid-cols-5 gap-4 items-center pt-3 border-t border-[#1A4331]/10 font-bold">
                  <span className="text-sm text-[#0A1711]">TOTAL</span>
                  <span className="text-right text-sm text-[#0A1711]">{totalNeeded}</span>
                  <span className="text-right text-sm text-[#0A1711]">{totalStock}</span>
                  <span className={`text-right text-sm ${totalShortfall > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {totalShortfall > 0 ? `-${totalShortfall}` : '0'}
                  </span>
                  <div className="flex justify-end">
                    {allFulfilled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle className="w-3 h-3" /> All good</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle className="w-3 h-3" /> Get from field</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scheduled Collections Timeline */}
          <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="scheduled-collections">
            <div className="px-6 py-4 border-b border-[#1A4331]/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit']">Scheduled Collections</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/loads')} className="text-[#1A4331]">
                Manage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            {upcomingCollections.length === 0 ? (
              <div className="py-12 text-center text-[#4A5D53]">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No upcoming collections scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1A4331]/5">
                {upcomingCollections.map((load) => {
                  const status = checkCollectionFulfillment(load.pallets_required);
                  const dateStr = load.departure_date;
                  const dateObj = dateStr ? new Date(dateStr + 'T00:00:00') : null;
                  const dayName = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'short' }) : '';
                  const dayNum = dateObj ? dateObj.getDate() : '';
                  const month = dateObj ? dateObj.toLocaleDateString('en-GB', { month: 'short' }) : '';

                  return (
                    <div key={load.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#F4F1ED]/30 transition-colors">
                      {/* Date block */}
                      <div className="w-14 h-14 rounded-xl bg-[#F4F1ED] flex flex-col items-center justify-center flex-shrink-0 border border-[#1A4331]/10">
                        <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold leading-none">{dayName}</span>
                        <span className="text-xl font-bold text-[#0A1711] font-['Outfit'] leading-none">{dayNum}</span>
                        <span className="text-[10px] uppercase text-[#4A5D53] leading-none">{month}</span>
                      </div>

                      {/* Status indicator */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${status === 'can_fulfill' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {status === 'can_fulfill' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0A1711] truncate">{load.driver_name || '—'}</p>
                        <div className="flex items-center gap-3 text-xs text-[#4A5D53] mt-0.5">
                          {load.destinations?.[0] && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#E27B58]" /> {load.destinations[0].address}</span>
                          )}
                        </div>
                      </div>

                      {/* Pallet requirements */}
                      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                        {(load.pallets_required || []).map((p, i) => {
                          const avail = getStockForColour(p.color);
                          const ok = avail >= p.quantity;
                          return (
                            <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_MAP[p.color] || '#1A4331' }} />
                              {p.quantity}x {p.color}
                              {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            </div>
                          );
                        })}
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
