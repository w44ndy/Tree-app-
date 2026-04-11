import React, { useState, useEffect } from 'react';
import { getLoads, getColours, getDashboardAnalytics, getFieldStatus } from '../lib/api';
import { CheckCircle, AlertTriangle, XCircle, Truck, Package, TreePine, Clock, Calendar, MapPin } from 'lucide-react';

const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };
const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";

export default function TVDashboard() {
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [fieldStatus, setFieldStatus] = useState({});
  const [time, setTime] = useState(new Date());

  const fetchAll = async () => {
    try {
      const [loadsRes, coloursRes, analyticsRes, fsRes] = await Promise.all([
        getLoads(), getColours(), getDashboardAnalytics(), getFieldStatus()
      ]);
      setLoads(loadsRes.data);
      setColours(coloursRes.data);
      setAnalytics(analyticsRes.data);
      const statusMap = {};
      (fsRes.data || []).forEach(s => { statusMap[s.color] = s.quantity || 0; });
      setFieldStatus(statusMap);
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    const dataInterval = setInterval(fetchAll, 30000); // Refresh every 30s
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
  }, []);

  const getStock = (color) => colours.find(c => c.color === color?.toLowerCase())?.quantity || 0;
  const totalStock = colours.reduce((s, c) => s + (c.quantity || 0), 0);

  const upcoming = loads
    .filter(l => l.status === 'loading')
    .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''));

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 86400000);
  const next7 = upcoming.filter(l => l.departure_date && new Date(l.departure_date + 'T00:00:00') <= in7days);

  const totalRequired = {};
  next7.forEach(l => (l.pallets_required || []).forEach(p => {
    const c = p.color?.toLowerCase();
    if (c) totalRequired[c] = (totalRequired[c] || 0) + p.quantity;
  }));

  const totalNeeded = Object.values(totalRequired).reduce((s, v) => s + v, 0);
  const totalShortfall = Object.entries(totalRequired).reduce((s, [c, n]) => s + Math.max(0, n - getStock(c)), 0);
  const allGood = totalShortfall === 0;

  const FULL_LOAD = 10;
  const totalFieldReady = Object.values(fieldStatus).reduce((s, v) => s + v, 0);
  const fullLoads = Math.floor(totalFieldReady / FULL_LOAD);

  const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const dDate = new Date(d); dDate.setHours(0,0,0,0);
    if (dDate.getTime() === today.getTime()) return 'TODAY';
    if (dDate.getTime() === tomorrow.getTime()) return 'TOMORROW';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#0A1711] text-white p-6 font-['Outfit']" data-testid="tv-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <img src={WC_LOGO} alt="Wilson Contractors" className="h-10 object-contain brightness-200" />
        <div className="text-right">
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm text-white/50">
            {time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 h-[calc(100vh-130px)]">
        {/* Left Column — Stock */}
        <div className="col-span-3 flex flex-col gap-5">
          {/* Overall status */}
          <div className={`rounded-2xl p-5 ${allGood && totalNeeded > 0 ? 'bg-emerald-900/40 border border-emerald-500/30' : totalNeeded === 0 ? 'bg-white/5 border border-white/10' : 'bg-red-900/30 border border-red-500/30'}`}>
            <div className="flex items-center gap-3 mb-2">
              {allGood ? <CheckCircle className="w-6 h-6 text-emerald-400" /> : totalNeeded > 0 ? <AlertTriangle className="w-6 h-6 text-red-400" /> : <Package className="w-6 h-6 text-white/40" />}
              <span className="text-lg font-bold">{totalNeeded === 0 ? 'No Orders' : allGood ? 'Stock OK' : `Need ${totalShortfall} More`}</span>
            </div>
            <p className="text-sm text-white/50">{allGood && totalNeeded > 0 ? 'All collections covered' : totalShortfall > 0 ? 'Collect from field' : 'No upcoming collections'}</p>
          </div>

          {/* Field Status */}
          <div className={`rounded-2xl p-4 ${totalFieldReady >= FULL_LOAD ? 'bg-emerald-900/40 border border-emerald-500/30' : totalFieldReady > 0 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-white/5 border border-white/10'}`} data-testid="tv-field-status">
            <div className="flex items-center gap-3 mb-2">
              <Truck className={`w-5 h-5 ${totalFieldReady >= FULL_LOAD ? 'text-emerald-400' : totalFieldReady > 0 ? 'text-amber-400' : 'text-white/40'}`} />
              <span className="text-base font-bold">Field Status</span>
              {totalFieldReady >= FULL_LOAD && (
                <span className="text-[10px] font-bold bg-emerald-500 text-black px-2 py-0.5 rounded-full ml-auto">{fullLoads} FULL</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold tabular-nums">{totalFieldReady}</span>
              <span className="text-sm text-white/50">/ {FULL_LOAD} for trailer</span>
            </div>
            <div className="mt-2 w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${totalFieldReady >= FULL_LOAD ? 'bg-emerald-500' : totalFieldReady >= 7 ? 'bg-amber-400' : 'bg-white/30'}`} style={{ width: `${Math.min(100, (totalFieldReady / FULL_LOAD) * 100)}%` }} />
            </div>
            {totalFieldReady > 0 && (
              <div className="flex gap-2 mt-2">
                {Object.entries(fieldStatus).filter(([_, q]) => q > 0).map(([color, qty]) => (
                  <div key={color} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[color] || '#fff' }} />
                    <span className="text-xs text-white/60">{qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock by colour */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5 flex-1">
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold mb-4">Current Stock</h3>
            <div className="space-y-3">
              {colours.map(c => {
                const needed = totalRequired[c.color] || 0;
                const ok = c.quantity >= needed;
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_HEX[c.color] || '#fff' }} />
                    <span className="text-sm font-medium capitalize flex-1">{c.label || c.color}</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold tabular-nums">{c.quantity}</span>
                      {needed > 0 && (
                        <span className={`text-xs ml-2 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                          / {needed} needed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm text-white/50">Total</span>
              <div>
                <span className="text-3xl font-bold">{totalStock}</span>
                <span className="text-sm text-white/40 ml-2">pallets</span>
              </div>
            </div>
            <p className="text-xs text-white/30 mt-1 text-right">{(totalStock * 100).toLocaleString()} trees</p>
          </div>
        </div>

        {/* Centre Column — Upcoming Collections */}
        <div className="col-span-6 flex flex-col gap-5">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5 flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold">Upcoming Collections</h3>
              <span className="text-sm text-white/50">{upcoming.length} scheduled</span>
            </div>
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/20">
                  <Truck className="w-12 h-12 mb-3" />
                  <p className="text-lg">No collections scheduled</p>
                </div>
              ) : (
                upcoming.map(load => {
                  const pallets = load.pallets_required || [];
                  const canFulfill = pallets.every(p => getStock(p.color) >= p.quantity);
                  const dateLabel = fmtDate(load.departure_date);
                  const isToday = dateLabel === 'TODAY';
                  const isTomorrow = dateLabel === 'TOMORROW';

                  return (
                    <div key={load.id} className={`rounded-xl p-4 border ${isToday ? 'bg-amber-900/20 border-amber-500/30' : 'bg-white/[0.03] border-white/10'}`}>
                      <div className="flex items-start gap-4">
                        {/* Date badge */}
                        <div className={`rounded-lg px-3 py-2 text-center flex-shrink-0 min-w-[70px] ${isToday ? 'bg-amber-500 text-black' : isTomorrow ? 'bg-white/15' : 'bg-white/5'}`}>
                          <p className={`text-xs font-bold ${isToday ? 'text-black' : 'text-white/60'}`}>{dateLabel}</p>
                        </div>

                        {/* Status */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${canFulfill ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                          {canFulfill ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base truncate">{load.driver_name || '—'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {load.destinations?.map((d, i) => (
                              <span key={i} className="text-xs text-white/40 flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-[#E27B58]" /> {d.address}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Pallets */}
                        <div className="flex gap-2 flex-shrink-0">
                          {pallets.map((p, i) => {
                            const ok = getStock(p.color) >= p.quantity;
                            return (
                              <div key={i} className={`rounded-lg px-3 py-1.5 text-center ${ok ? 'bg-emerald-500/15 border border-emerald-500/20' : 'bg-red-500/15 border border-red-500/20'}`}>
                                <p className="text-xl font-bold tabular-nums">{p.quantity}</p>
                                <p className="text-[10px] capitalize text-white/50">{p.color}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column — Stats */}
        <div className="col-span-3 flex flex-col gap-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <TreePine className="w-4 h-4 text-emerald-400 mb-2" />
              <p className="text-2xl font-bold tabular-nums">{analytics?.total_out || 0}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Dispatched</p>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <Clock className="w-4 h-4 text-blue-400 mb-2" />
              <p className="text-2xl font-bold tabular-nums">{analytics?.avg_yard_days || 0}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Avg Days</p>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <Truck className="w-4 h-4 text-[#E27B58] mb-2" />
              <p className="text-2xl font-bold tabular-nums">{upcoming.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Upcoming</p>
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <Package className="w-4 h-4 text-yellow-400 mb-2" />
              <p className="text-2xl font-bold tabular-nums">{(totalStock * 100).toLocaleString()}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Trees</p>
            </div>
          </div>

          {/* Hauler leaderboard */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5 flex-1">
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold mb-4">Top Haulers</h3>
            <div className="space-y-3">
              {(analytics?.hauler_stats || []).slice(0, 6).map((h, i) => {
                const max = Math.max(...(analytics?.hauler_stats || []).map(x => x.loads));
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/70 truncate max-w-[140px]">{h.hauler}</span>
                      <span className="text-xs font-bold tabular-nums">{h.loads} loads</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E27B58] rounded-full" style={{ width: `${max > 0 ? (h.loads / max) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
              {!analytics?.hauler_stats?.length && (
                <p className="text-sm text-white/20 text-center py-4">No hauler data</p>
              )}
            </div>
          </div>

          {/* Colour demand */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold mb-3">Demand</h3>
            <div className="flex gap-3">
              {(analytics?.colour_demand || []).slice(0, 4).map((c, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ backgroundColor: COLOR_HEX[c.color] || '#fff' }} />
                  <p className="text-lg font-bold tabular-nums">{c.total}</p>
                  <p className="text-[9px] text-white/40 capitalize">{c.color}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-white/20 text-[10px]">
        <span>TMS.wilson-contractors.co.uk</span>
        <span>Mains of Corsindae, Sauchen, AB51 7PN</span>
        <span>Auto-refreshes every 30s</span>
      </div>
    </div>
  );
}
