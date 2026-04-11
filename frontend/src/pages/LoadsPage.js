import React, { useState, useEffect } from 'react';
import { getLoads, createLoad, getColours } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash2, Truck, MapPin, Calendar, Building2, CheckCircle, AlertTriangle, XCircle, ClipboardCheck, Eye, EyeOff, FileText, PenTool } from 'lucide-react';
import { toast } from 'sonner';

export default function LoadsPage() {
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDispatched, setShowDispatched] = useState(false);
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
    const items = pallets_required.map(p => {
      const available = getStockForColour(p.color);
      const ok = available >= p.quantity;
      if (!ok) allOk = false;
      return { ...p, available, ok, shortfall: ok ? 0 : p.quantity - available };
    });
    return { status: allOk ? 'can_fulfill' : 'need_more', items };
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

  // Split into upcoming and dispatched
  const upcoming = loads
    .filter(l => l.status === 'loading')
    .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''));

  const dispatched = loads
    .filter(l => l.status === 'in_transit' || l.status === 'delivered')
    .sort((a, b) => (b.departure_date || '').localeCompare(a.departure_date || ''));

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const CollectionCard = ({ load }) => {
    const check = checkFulfillment(load.pallets_required);
    const isDispatched = load.status === 'in_transit' || load.status === 'delivered';
    const isSigned = !!load.signature;

    return (
      <div className={`bg-white border rounded-xl p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${isDispatched ? 'border-gray-200' : 'border-[#1A4331]/15'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Building2 className="w-4 h-4 text-[#4A5D53] flex-shrink-0" />
              <span className="font-semibold text-[#0A1711] font-['Outfit']">{load.driver_name || '—'}</span>
              {isDispatched ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <CheckCircle className="w-3 h-3" /> Dispatched
                </span>
              ) : check.status === 'can_fulfill' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <CheckCircle className="w-3 h-3" /> In Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-800">
                  <AlertTriangle className="w-3 h-3" /> Need More
                </span>
              )}
              {isSigned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-800">
                  <PenTool className="w-3 h-3" /> Signed
                </span>
              )}
            </div>

            {/* Date + destinations */}
            <div className="flex items-center gap-3 text-sm text-[#4A5D53] mb-3 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(load.departure_date)}</span>
              {load.destinations?.map((d, i) => (
                <span key={i} className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#E27B58]" /> {d.address}</span>
              ))}
            </div>

            {/* Pallets */}
            <div className="flex flex-wrap gap-2">
              {(load.pallets_required || []).map((p, i) => {
                const available = getStockForColour(p.color);
                const ok = available >= p.quantity;
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isDispatched ? 'bg-gray-100' : ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className={`color-badge ${p.color}`}>{p.color}</span>
                    <span className="font-bold">{p.quantity}</span>
                    <span className="text-xs text-gray-500">pallets</span>
                    {!isDispatched && (ok ?
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> :
                      <span className="text-[10px] text-red-600 font-bold">need {p.quantity - available}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Notes preview */}
            {load.notes && (
              <p className="text-xs text-[#4A5D53] mt-2 italic">Note: {load.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {!isDispatched && (
              <Button size="sm" onClick={() => window.location.href = `/manifest/${load.id}`} className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90" data-testid={`dispatch-${load.id}`}>
                <ClipboardCheck className="w-3 h-3 mr-1" /> Ready for Dispatch
              </Button>
            )}
            {/* Preview / View manifest */}
            <Button size="sm" variant="outline" onClick={() => window.open(`/manifest/${load.id}`, '_blank')} className="border-[#1A4331]/20 text-[#4A5D53]" data-testid={`view-manifest-${load.id}`}>
              <FileText className="w-3 h-3 mr-1" /> {isDispatched ? 'View Manifest' : 'Preview'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="loads-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Collections</h1>
          <p className="text-sm text-[#4A5D53] mt-1">{upcoming.length} upcoming &middot; {dispatched.length} dispatched</p>
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
                            <span className="text-[10px] text-red-600 font-bold">Need {p.quantity - stock}</span>
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

      {/* Upcoming Collections */}
      <div>
        <h2 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-3">Upcoming</h2>
        <div className="space-y-3" data-testid="upcoming-list">
          {upcoming.length === 0 ? (
            <div className="bg-white border border-[#1A4331]/15 rounded-xl py-12 flex flex-col items-center text-[#4A5D53]">
              <Truck className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No upcoming collections</p>
            </div>
          ) : (
            upcoming.map(load => <CollectionCard key={load.id} load={load} />)
          )}
        </div>
      </div>

      {/* Dispatched - toggleable */}
      {dispatched.length > 0 && (
        <div>
          <button
            onClick={() => setShowDispatched(!showDispatched)}
            className="flex items-center gap-2 text-sm font-semibold text-[#4A5D53] hover:text-[#0A1711] transition-colors mb-3"
            data-testid="toggle-dispatched"
          >
            {showDispatched ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showDispatched ? 'Hide' : 'Show'} Dispatched ({dispatched.length})
          </button>
          {showDispatched && (
            <div className="space-y-3 opacity-75" data-testid="dispatched-list">
              {dispatched.map(load => <CollectionCard key={load.id} load={load} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
