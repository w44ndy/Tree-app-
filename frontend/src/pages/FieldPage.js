import React, { useState, useEffect } from 'react';
import { getColours, getFieldCollections, createFieldCollection } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TreePine, Plus, Minus, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };

export default function FieldPage() {
  const [colours, setColours] = useState([]);
  const [collections, setCollections] = useState([]);
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, fcRes] = await Promise.all([getColours(), getFieldCollections()]);
      setColours(colRes.data);
      setCollections(fcRes.data);
      // Init counts to 0
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

  const totalPallets = Object.values(counts).reduce((s, v) => s + v, 0);

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
        <p className="text-sm text-[#4A5D53] mt-1">Collecting from the field? Tap + for each colour</p>
      </div>

      {/* Big colour counter cards */}
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
