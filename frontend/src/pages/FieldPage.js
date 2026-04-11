import React, { useState, useEffect } from 'react';
import { getColours, getFieldCollections, createFieldCollection, getFieldStatus, updateFieldStatus } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TreePine, Plus, Minus, Check, Clock, Truck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };
const FULL_LOAD = 10;

export default function FieldPage() {
  const [colours, setColours] = useState([]);
  const [collections, setCollections] = useState([]);
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldStatus, setFieldStatus] = useState({});
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, fcRes, fsRes] = await Promise.all([getColours(), getFieldCollections(), getFieldStatus()]);
      setColours(colRes.data);
      setCollections(fcRes.data);
      const statusMap = {};
      (fsRes.data || []).forEach(s => { statusMap[s.color] = s.quantity || 0; });
      setFieldStatus(statusMap);
      const init = {};
      colRes.data.forEach(c => { init[c.color] = 0; });
      setCounts(init);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const adjust = (color, delta) => {
    setCounts(prev => ({ ...prev, [color]: Math.max(0, (prev[color] || 0) + delta) }));
  };

  const adjustReady = async (color, delta) => {
    const newQty = Math.max(0, (fieldStatus[color] || 0) + delta);
    setUpdatingStatus(color);
    try {
      await updateFieldStatus({ color, quantity: newQty });
      setFieldStatus(prev => ({ ...prev, [color]: newQty }));
    } catch { toast.error('Failed to update status'); }
    setUpdatingStatus(null);
  };

  const totalPallets = Object.values(counts).reduce((s, v) => s + v, 0);
  const totalReady = Object.values(fieldStatus).reduce((s, v) => s + v, 0);
  const fullLoads = Math.floor(totalReady / FULL_LOAD);
  const remainder = totalReady % FULL_LOAD;

  const handleSubmit = async () => {
    if (totalPallets === 0) return toast.error('Add at least 1 pallet');
    setSubmitting(true);
    try {
      const items = Object.entries(counts).filter(([_, q]) => q > 0).map(([color, quantity]) => ({ color, quantity }));
      await createFieldCollection({ items, notes });
      toast.success(`${totalPallets} pallets collected from field`);
      setNotes('');
      fetchData();
    } catch { toast.error('Failed to save'); }
    setSubmitting(false);
  };

  const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6" data-testid="field-page">
      <div>
        <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Field Collection</h1>
        <p className="text-sm text-[#4A5D53] mt-1">Mark pallets ready in the field, then collect to yard</p>
      </div>

      {/* Field Status — Ready for Collection */}
      <div className="space-y-3" data-testid="field-status-section">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0A1711] font-['Outfit']">Field Status</h2>
          <span className="text-xs text-[#4A5D53]">Full trailer = {FULL_LOAD} pallets</span>
        </div>

        {/* Full load alert */}
        {totalReady >= FULL_LOAD && (
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4 flex items-center gap-3 animate-in fade-in" data-testid="full-load-alert">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-emerald-800 font-['Outfit'] text-base">
                {fullLoads} Full Load{fullLoads > 1 ? 's' : ''} Ready!
              </p>
              <p className="text-xs text-emerald-600">
                {totalReady} pallets ready in field — {fullLoads}x full trailer{fullLoads > 1 ? 's' : ''}{remainder > 0 ? ` + ${remainder} extra` : ''}
              </p>
            </div>
          </div>
        )}

        {totalReady > 0 && totalReady < FULL_LOAD && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3" data-testid="partial-load-alert">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-semibold">{totalReady} of {FULL_LOAD}</span> pallets ready — need {FULL_LOAD - totalReady} more for a full load
            </p>
          </div>
        )}

        {/* Ready counts per colour */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="field-status-grid">
          {colours.map((c) => {
            const ready = fieldStatus[c.color] || 0;
            return (
              <div key={c.color} className="bg-white border border-[#1A4331]/15 rounded-xl p-3 flex items-center gap-3" data-testid={`status-${c.color}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLOR_HEX[c.color] || '#1A4331' }}>
                  <TreePine className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0A1711] font-['Outfit'] capitalize text-sm">{c.label || c.color}</p>
                  <p className="text-[10px] text-[#4A5D53]">ready in field</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => adjustReady(c.color, -1)}
                    disabled={ready === 0 || updatingStatus === c.color}
                    className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 active:scale-95 transition-transform disabled:opacity-30"
                    data-testid={`status-minus-${c.color}`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-10 text-center">
                    <p className="text-xl font-bold text-[#0A1711] font-['Outfit'] tabular-nums">{ready}</p>
                  </div>
                  <button
                    onClick={() => adjustReady(c.color, 1)}
                    disabled={updatingStatus === c.color}
                    className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 active:scale-95 transition-transform disabled:opacity-30"
                    data-testid={`status-plus-${c.color}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total ready bar */}
        {colours.length > 0 && (
          <div className="bg-white border border-[#1A4331]/15 rounded-xl p-3" data-testid="field-status-total">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#4A5D53] uppercase tracking-wider">Total Ready</span>
              <span className="text-lg font-bold text-[#0A1711] font-['Outfit']">{totalReady} <span className="text-xs font-normal text-[#4A5D53]">/ {FULL_LOAD} for full load</span></span>
            </div>
            <div className="w-full h-3 bg-[#F4F1ED] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${totalReady >= FULL_LOAD ? 'bg-emerald-500' : totalReady >= FULL_LOAD * 0.7 ? 'bg-amber-400' : 'bg-[#1A4331]'}`}
                style={{ width: `${Math.min(100, (totalReady / FULL_LOAD) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#1A4331]/10" />

      {/* Collect from Field to Yard */}
      <div>
        <h2 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-1">Collect to Yard</h2>
        <p className="text-xs text-[#4A5D53] mb-3">Bringing pallets from field to yard? Tap + for each colour below</p>
      </div>

      <div className="space-y-3" data-testid="colour-counters">
        {colours.map((c) => (
          <div key={c.color} className="bg-white border border-[#1A4331]/15 rounded-xl p-4 flex items-center gap-4" data-testid={`field-${c.color}`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLOR_HEX[c.color] || '#1A4331' }}>
              <TreePine className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#0A1711] font-['Outfit'] capitalize text-lg">{c.label || c.color}</p>
              <p className="text-xs text-[#4A5D53]">Currently: {c.quantity} pallets in yard</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => adjust(c.color, -1)}
                className="w-12 h-12 rounded-xl bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-600 active:scale-95 transition-transform"
                data-testid={`minus-${c.color}`}
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="w-16 text-center">
                <p className="text-3xl font-bold text-[#0A1711] font-['Outfit']">{counts[c.color] || 0}</p>
              </div>
              <button
                onClick={() => adjust(c.color, 1)}
                className="w-12 h-12 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 active:scale-95 transition-transform"
                data-testid={`plus-${c.color}`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notes + Submit */}
      {totalPallets > 0 && (
        <div className="bg-[#1A4331]/5 border border-[#1A4331]/15 rounded-xl p-4 space-y-3" data-testid="field-submit-section">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0A1711]">Total this collection:</span>
            <span className="text-2xl font-bold text-[#1A4331] font-['Outfit']">{totalPallets} pallets</span>
          </div>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="bg-white"
            data-testid="field-notes-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 bg-[#1A4331] text-white text-lg font-semibold rounded-xl"
            data-testid="submit-field-collection"
          >
            <Check className="w-5 h-5 mr-2" /> Save Collection
          </Button>
        </div>
      )}

      {/* Recent collections */}
      <div>
        <h2 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-3">Recent Field Collections</h2>
        <div className="space-y-2" data-testid="field-history">
          {collections.length === 0 ? (
            <div className="bg-white border border-[#1A4331]/15 rounded-xl py-8 text-center text-[#4A5D53]">
              <TreePine className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No field collections yet</p>
            </div>
          ) : (
            collections.slice(0, 10).map((fc) => (
              <div key={fc.id} className="bg-white border border-[#1A4331]/15 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-[#4A5D53] flex-shrink-0 w-36">
                  <Clock className="w-3 h-3" />
                  {fmtDate(fc.created_at)}
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {fc.items?.map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: `${COLOR_HEX[item.color] || '#1A4331'}15`, color: COLOR_HEX[item.color] || '#1A4331' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_HEX[item.color] || '#1A4331' }} />
                      {item.quantity}x {item.color}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-bold text-[#0A1711] flex-shrink-0">{fc.total_pallets}p</span>
                {fc.collected_by && <span className="text-xs text-[#4A5D53] flex-shrink-0">{fc.collected_by}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
