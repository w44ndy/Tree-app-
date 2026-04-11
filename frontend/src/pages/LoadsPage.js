import React, { useState, useEffect } from 'react';
import { getLoads, createLoad, updateLoad, getColours } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash2, Truck, MapPin, Calendar, Building2, CheckCircle, AlertTriangle, XCircle, Package, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function LoadsPage() {
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    company_name: '', driver_name: '', registration: '',
    collection_date: '', destinations: [{ address: '' }],
    pallets: [{ color: '', quantity: 1 }], notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loadRes, colourRes] = await Promise.all([getLoads(), getColours()]);
      setLoads(loadRes.data);
      setColours(colourRes.data);
    } catch (err) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getStockForColour = (color) => {
    const c = colours.find(cl => cl.color === color?.toLowerCase());
    return c?.quantity || 0;
  };

  const checkFulfillment = (pallets_required) => {
    if (!pallets_required?.length) return { status: 'none', items: [] };
    let allOk = true;
    let someOk = false;
    const items = pallets_required.map(p => {
      const available = getStockForColour(p.color);
      const ok = available >= p.quantity;
      if (ok) someOk = true;
      else allOk = false;
      return { ...p, available, ok, shortfall: ok ? 0 : p.quantity - available };
    });
    return {
      status: allOk ? 'can_fulfill' : someOk ? 'partial' : 'cannot_fulfill',
      items
    };
  };

  // Form handlers
  const addDest = () => setForm({ ...form, destinations: [...form.destinations, { address: '' }] });
  const removeDest = (idx) => setForm({ ...form, destinations: form.destinations.filter((_, i) => i !== idx) });
  const updateDest = (idx, val) => { const d = [...form.destinations]; d[idx] = { address: val }; setForm({ ...form, destinations: d }); };
  const addPalletReq = () => setForm({ ...form, pallets: [...form.pallets, { color: '', quantity: 1 }] });
  const removePalletReq = (idx) => setForm({ ...form, pallets: form.pallets.filter((_, i) => i !== idx) });
  const updatePalletReq = (idx, field, val) => {
    const p = [...form.pallets];
    p[idx] = { ...p[idx], [field]: field === 'quantity' ? parseInt(val) || 1 : val };
    setForm({ ...form, pallets: p });
  };

  const handleCreate = async () => {
    if (!form.company_name.trim()) return toast.error('Enter company name');
    if (!form.collection_date) return toast.error('Enter collection date');
    try {
      const driverInfo = `${form.company_name}${form.driver_name ? ' — ' + form.driver_name : ''}${form.registration ? ' (' + form.registration + ')' : ''}`;
      await createLoad({
        lorry_id: 'external',
        driver_name: driverInfo,
        destinations: form.destinations.filter(d => d.address.trim()),
        departure_date: form.collection_date,
        notes: form.notes,
        pallets_required: form.pallets.filter(p => p.color)
      });
      toast.success('Collection scheduled');
      setShowCreate(false);
      setForm({ company_name: '', driver_name: '', registration: '', collection_date: '', destinations: [{ address: '' }], pallets: [{ color: '', quantity: 1 }], notes: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to create');
    }
  };

  // Sort by date, upcoming first
  const sortedLoads = [...loads].sort((a, b) => {
    if (a.status === 'delivered' && b.status !== 'delivered') return 1;
    if (b.status === 'delivered' && a.status !== 'delivered') return -1;
    return (a.departure_date || '').localeCompare(b.departure_date || '');
  });

  const FulfillmentBadge = ({ load }) => {
    const check = checkFulfillment(load.pallets_required);
    if (check.status === 'none') return null;
    if (load.status === 'in_transit' || load.status === 'delivered') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">Dispatched</span>;
    }
    if (check.status === 'can_fulfill') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3" /> In Stock</span>;
    }
    if (check.status === 'partial') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3" /> Partial</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Need More</span>;
  };

  return (
    <div className="space-y-6" data-testid="loads-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Collections</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Schedule collections — auto-checks if stock can fulfill</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-load-button">
              <Plus className="w-4 h-4 mr-2" /> New Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="create-load-dialog">
            <DialogHeader><DialogTitle className="font-['Outfit']">Schedule Collection</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Company Name</Label>
                <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Highland Haulage" data-testid="company-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Driver (optional)</Label>
                  <Input value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} placeholder="Driver name" />
                </div>
                <div>
                  <Label>Registration (optional)</Label>
                  <Input value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} placeholder="e.g. AB12 CDE" />
                </div>
              </div>
              <div>
                <Label>Collection Date</Label>
                <Input type="date" value={form.collection_date} onChange={e => setForm({ ...form, collection_date: e.target.value })} data-testid="collection-date-input" />
              </div>
              <div>
                <Label className="flex items-center justify-between">Destination(s)
                  <Button type="button" variant="ghost" size="sm" onClick={addDest} className="text-[#1A4331]"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </Label>
                <div className="space-y-2 mt-1">
                  {form.destinations.map((dest, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input value={dest.address} onChange={e => updateDest(idx, e.target.value)} className="flex-1" placeholder="Delivery address" />
                      {form.destinations.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeDest(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="flex items-center justify-between">Pallets Required
                  <Button type="button" variant="ghost" size="sm" onClick={addPalletReq} className="text-[#1A4331]"><Plus className="w-3 h-3 mr-1" /> Add Colour</Button>
                </Label>
                <div className="space-y-2 mt-1">
                  {form.pallets.map((p, idx) => {
                    const stock = getStockForColour(p.color);
                    const enough = !p.color || stock >= p.quantity;
                    return (
                      <div key={idx} className={`flex items-end gap-2 p-3 rounded-lg ${enough ? 'bg-[#F4F1ED]' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex-1">
                          <span className="text-xs text-[#4A5D53]">Colour</span>
                          <Select value={p.color} onValueChange={v => updatePalletReq(idx, 'color', v)}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {colours.map(c => (
                                <SelectItem key={c.color} value={c.color} className="capitalize">{c.label || c.color} (stock: {c.quantity})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <span className="text-xs text-[#4A5D53]">Pallets</span>
                          <Input type="number" min={1} value={p.quantity} onChange={e => updatePalletReq(idx, 'quantity', e.target.value)} className="bg-white" />
                        </div>
                        <div className="w-16 text-center pb-2">
                          {p.color && (enough ?
                            <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> :
                            <span className="text-[10px] text-red-600 font-bold">Need {p.quantity - stock} more</span>
                          )}
                        </div>
                        {form.pallets.length > 1 && <Button variant="ghost" size="sm" onClick={() => removePalletReq(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A4331] text-white" data-testid="submit-load-button">Schedule Collection</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Collections Cards */}
      <div className="space-y-3" data-testid="collections-list">
        {sortedLoads.length === 0 ? (
          <div className="bg-white border border-[#1A4331]/15 rounded-xl py-16 flex flex-col items-center text-[#4A5D53]">
            <Truck className="w-10 h-10 mb-3 opacity-40" />
            <p className="font-medium">No collections scheduled</p>
            <p className="text-sm">Click "New Collection" to schedule one</p>
          </div>
        ) : (
          sortedLoads.map((load) => {
            const check = checkFulfillment(load.pallets_required);
            const isUpcoming = load.status === 'loading';
            return (
              <div key={load.id} className={`bg-white border rounded-xl p-5 transition-all duration-200 hover:shadow-md ${isUpcoming ? 'border-[#1A4331]/15' : 'border-gray-200 opacity-75'}`} data-testid={`collection-${load.id}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-4 h-4 text-[#4A5D53] flex-shrink-0" />
                      <span className="font-semibold text-[#0A1711] font-['Outfit']">{load.driver_name || '—'}</span>
                      <FulfillmentBadge load={load} />
                      <span className={`status-badge ${load.status}`}>{load.status?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#4A5D53] mb-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {load.departure_date || '—'}</span>
                      {load.destinations?.map((d, i) => (
                        <span key={i} className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#E27B58]" /> {d.address}</span>
                      ))}
                    </div>
                    {/* Pallet requirements with fulfillment check */}
                    <div className="flex flex-wrap gap-2">
                      {(load.pallets_required || []).map((p, i) => {
                        const available = getStockForColour(p.color);
                        const ok = available >= p.quantity;
                        const dispatched = load.status === 'in_transit' || load.status === 'delivered';
                        return (
                          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${dispatched ? 'bg-gray-100' : ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                            <span className={`color-badge ${p.color}`}>{p.color}</span>
                            <span className="font-bold">{p.quantity}</span>
                            <span className="text-xs text-gray-500">pallets</span>
                            {!dispatched && (ok ?
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> :
                              <span className="text-[10px] text-red-600 font-bold">need {p.quantity - available} from field</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {load.status === 'loading' && (
                      <Button size="sm" onClick={() => window.location.href = `/manifest/${load.id}`} className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90" data-testid={`dispatch-${load.id}`}>
                        <ClipboardCheck className="w-3 h-3 mr-1" /> Ready for Dispatch
                      </Button>
                    )}
                    {load.status === 'in_transit' && (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Dispatched
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
