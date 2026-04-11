import React, { useState, useEffect, useRef } from 'react';
import { getLoads, createLoad, getColours, getManifestPublic, signManifest, updateLoad, getHaulers, createHauler } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash2, Truck, MapPin, Calendar, Building2, CheckCircle, AlertTriangle, XCircle, ClipboardCheck, Eye, EyeOff, FileText, PenTool, Check, Printer } from 'lucide-react';
import { toast } from 'sonner';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";
const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };

function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
  };
  const startDraw = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); setIsDrawing(true); setHasDrawn(true); };
  const draw = (e) => { if (!isDrawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0A1711'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const endDraw = () => setIsDrawing(false);
  const clear = () => { canvasRef.current.getContext('2d').clearRect(0, 0, 600, 200); setHasDrawn(false); };
  return (
    <div>
      <div className="border-2 border-dashed border-[#1A4331]/30 rounded-lg bg-white overflow-hidden">
        <canvas ref={canvasRef} width={600} height={200} className="w-full touch-none" style={{ height: '100px' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <button onClick={clear} className="text-xs text-[#4A5D53] underline">Clear</button>
        <Button onClick={() => hasDrawn && onSave(canvasRef.current.toDataURL('image/png'))} disabled={!hasDrawn} size="sm" className="bg-[#1A4331] text-white">
          <Check className="w-3 h-3 mr-1" /> Confirm & Dispatch
        </Button>
      </div>
    </div>
  );
}

export default function LoadsPage() {
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [haulers, setHaulers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDispatched, setShowDispatched] = useState(false);
  const [showManifest, setShowManifest] = useState(null); // load id for dispatch flow
  const [showViewManifest, setShowViewManifest] = useState(null); // load id for viewing signed
  const [manifestLoad, setManifestLoad] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [driverName, setDriverName] = useState('');
  const [registration, setRegistration] = useState('');
  const [newHauler, setNewHauler] = useState('');
  const [form, setForm] = useState({
    hauler: '', collection_date: '', destinations: [{ address: '' }],
    pallets: [{ color: '', quantity: 1 }], notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loadRes, colourRes, haulerRes] = await Promise.all([getLoads(), getColours(), getHaulers()]);
      setLoads(loadRes.data);
      setColours(colourRes.data);
      setHaulers(haulerRes.data);
    } catch (err) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getStockForColour = (color) => colours.find(c => c.color === color?.toLowerCase())?.quantity || 0;

  const checkFulfillment = (pallets_required) => {
    if (!pallets_required?.length) return 'none';
    for (const p of pallets_required) {
      if (getStockForColour(p.color) < p.quantity) return 'need_more';
    }
    return 'can_fulfill';
  };

  // Form handlers
  const addDest = () => setForm({ ...form, destinations: [...form.destinations, { address: '' }] });
  const removeDest = (i) => setForm({ ...form, destinations: form.destinations.filter((_, idx) => idx !== i) });
  const updateDest = (i, v) => { const d = [...form.destinations]; d[i] = { address: v }; setForm({ ...form, destinations: d }); };
  const addPalletReq = () => setForm({ ...form, pallets: [...form.pallets, { color: '', quantity: 1 }] });
  const removePalletReq = (i) => setForm({ ...form, pallets: form.pallets.filter((_, idx) => idx !== i) });
  const updatePalletReq = (i, f, v) => { const p = [...form.pallets]; p[i] = { ...p[i], [f]: f === 'quantity' ? parseInt(v) || 1 : v }; setForm({ ...form, pallets: p }); };

  const handleAddHauler = async () => {
    if (!newHauler.trim()) return;
    try {
      const { data } = await createHauler({ name: newHauler.trim() });
      setHaulers([...haulers, data]);
      setForm({ ...form, hauler: data.name });
      setNewHauler('');
      toast.success('Hauler added');
    } catch { toast.error('Failed'); }
  };

  const handleCreate = async () => {
    if (!form.hauler) return toast.error('Select a hauler');
    if (!form.collection_date) return toast.error('Enter collection date');
    try {
      await createLoad({
        lorry_id: 'external',
        driver_name: form.hauler,
        destinations: form.destinations.filter(d => d.address.trim()),
        departure_date: form.collection_date,
        notes: form.notes,
        pallets_required: form.pallets.filter(p => p.color)
      });
      toast.success('Collection scheduled');
      setShowCreate(false);
      setForm({ hauler: '', collection_date: '', destinations: [{ address: '' }], pallets: [{ color: '', quantity: 1 }], notes: '' });
      fetchData();
    } catch { toast.error('Failed to create'); }
  };

  // Open dispatch manifest
  const openDispatchManifest = async (loadId) => {
    try {
      const { data } = await getManifestPublic(loadId);
      setManifestLoad(data.load);
      setCheckedItems({});
      setDriverName('');
      setRegistration('');
      setShowManifest(loadId);
    } catch { toast.error('Failed to load'); }
  };

  // Open signed manifest viewer
  const openViewManifest = async (loadId) => {
    try {
      const { data } = await getManifestPublic(loadId);
      setManifestLoad(data.load);
      setShowViewManifest(loadId);
    } catch { toast.error('Failed to load'); }
  };

  // Sign and dispatch
  const handleSign = async (signatureData) => {
    if (!driverName.trim()) return toast.error('Enter driver name');
    try {
      await signManifest(showManifest, { driver_name: driverName, signature_data: signatureData, registration });
      try { await updateLoad(showManifest, { status: 'in_transit' }); } catch {}
      toast.success('Signed & dispatched');
      setShowManifest(null);
      setManifestLoad(null);
      fetchData();
    } catch { toast.error('Failed to sign'); }
  };

  const toggleCheck = (i) => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }));

  const upcoming = loads.filter(l => l.status === 'loading').sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''));
  const dispatched = loads.filter(l => l.status === 'in_transit' || l.status === 'delivered').sort((a, b) => (b.departure_date || '').localeCompare(a.departure_date || ''));

  const fmtDate = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';

  const CollectionCard = ({ load }) => {
    const status = checkFulfillment(load.pallets_required);
    const isDispatched = load.status !== 'loading';
    const isSigned = !!load.signature;

    return (
      <div className={`bg-white border rounded-xl p-4 sm:p-5 transition-all hover:shadow-md ${isDispatched ? 'border-gray-200' : 'border-[#1A4331]/15'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Building2 className="w-4 h-4 text-[#4A5D53] flex-shrink-0" />
              <span className="font-semibold text-[#0A1711] font-['Outfit']">{load.driver_name || '—'}</span>
              {isDispatched ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3" /> Dispatched</span>
              ) : status === 'can_fulfill' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3" /> In Stock</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3" /> Need More</span>
              )}
              {isSigned && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-800"><PenTool className="w-3 h-3" /> Signed</span>}
            </div>
            <div className="flex items-center gap-3 text-sm text-[#4A5D53] mb-2 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(load.departure_date)}</span>
              {load.destinations?.map((d, i) => <span key={i} className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#E27B58]" /> {d.address}</span>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(load.pallets_required || []).map((p, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${isDispatched ? 'bg-gray-100 text-gray-700' : getStockForColour(p.color) >= p.quantity ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_HEX[p.color] || '#1A4331' }} />
                  {p.quantity}x {p.color}
                </span>
              ))}
            </div>
            {load.notes && <p className="text-xs text-[#4A5D53] mt-1.5 italic">Note: {load.notes}</p>}
          </div>
          <div className="flex-shrink-0">
            {!isDispatched ? (
              <Button size="sm" onClick={() => openDispatchManifest(load.id)} className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90" data-testid={`dispatch-${load.id}`}>
                <ClipboardCheck className="w-3 h-3 mr-1" /> Ready for Dispatch
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openViewManifest(load.id)} className="border-[#1A4331]/20 text-[#4A5D53]" data-testid={`view-manifest-${load.id}`}>
                <FileText className="w-3 h-3 mr-1" /> View Manifest
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Manifest pallets for current dialog
  const mPallets = manifestLoad?.pallets_required || [];
  const allChecked = mPallets.length > 0 && mPallets.every((_, i) => checkedItems[i]);

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
                <Label className="flex items-center justify-between">Hauler / Company
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="text-[#1A4331] text-xs"><Plus className="w-3 h-3 mr-1" /> Add New</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader><DialogTitle className="font-['Outfit']">Add Hauler</DialogTitle></DialogHeader>
                      <div className="flex gap-2 mt-3">
                        <Input value={newHauler} onChange={e => setNewHauler(e.target.value)} placeholder="Company name" className="flex-1" />
                        <Button onClick={handleAddHauler} className="bg-[#1A4331] text-white">Add</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </Label>
                <Select value={form.hauler} onValueChange={v => setForm({ ...form, hauler: v })}>
                  <SelectTrigger data-testid="hauler-select"><SelectValue placeholder="Select hauler" /></SelectTrigger>
                  <SelectContent>
                    {haulers.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                  {form.destinations.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={d.address} onChange={e => updateDest(i, e.target.value)} className="flex-1" placeholder="Delivery address" />
                      {form.destinations.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeDest(i)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="flex items-center justify-between">Pallets Required
                  <Button type="button" variant="ghost" size="sm" onClick={addPalletReq} className="text-[#1A4331]"><Plus className="w-3 h-3 mr-1" /> Add Colour</Button>
                </Label>
                <div className="space-y-2 mt-1">
                  {form.pallets.map((p, i) => {
                    const stock = getStockForColour(p.color);
                    const ok = !p.color || stock >= p.quantity;
                    return (
                      <div key={i} className={`flex items-end gap-2 p-3 rounded-lg ${ok ? 'bg-[#F4F1ED]' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex-1">
                          <span className="text-xs text-[#4A5D53]">Colour</span>
                          <Select value={p.color} onValueChange={v => updatePalletReq(i, 'color', v)}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{colours.map(c => <SelectItem key={c.color} value={c.color} className="capitalize">{c.label || c.color} (stock: {c.quantity})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <span className="text-xs text-[#4A5D53]">Pallets</span>
                          <Input type="number" min={1} value={p.quantity} onChange={e => updatePalletReq(i, 'quantity', e.target.value)} className="bg-white" />
                        </div>
                        <div className="w-14 text-center pb-2">
                          {p.color && (ok ? <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> : <span className="text-[10px] text-red-600 font-bold">-{p.quantity - stock}</span>)}
                        </div>
                        {form.pallets.length > 1 && <Button variant="ghost" size="sm" onClick={() => removePalletReq(i)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>}
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

      {/* Upcoming */}
      <div>
        <h2 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-3">Upcoming</h2>
        <div className="space-y-3" data-testid="upcoming-list">
          {upcoming.length === 0 ? (
            <div className="bg-white border border-[#1A4331]/15 rounded-xl py-12 flex flex-col items-center text-[#4A5D53]">
              <Truck className="w-8 h-8 mb-2 opacity-40" /><p className="text-sm">No upcoming collections</p>
            </div>
          ) : upcoming.map(l => <CollectionCard key={l.id} load={l} />)}
        </div>
      </div>

      {/* Dispatched toggle */}
      {dispatched.length > 0 && (
        <div>
          <button onClick={() => setShowDispatched(!showDispatched)} className="flex items-center gap-2 text-sm font-semibold text-[#4A5D53] hover:text-[#0A1711] transition-colors mb-3" data-testid="toggle-dispatched">
            {showDispatched ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showDispatched ? 'Hide' : 'Show'} Dispatched ({dispatched.length})
          </button>
          {showDispatched && (
            <div className="space-y-3 opacity-75" data-testid="dispatched-list">
              {dispatched.map(l => <CollectionCard key={l.id} load={l} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Dispatch Manifest Dialog (inline check-off + sign) ── */}
      <Dialog open={!!showManifest} onOpenChange={(open) => { if (!open) { setShowManifest(null); setManifestLoad(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dispatch-manifest-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Dispatch — Check Off & Sign</DialogTitle></DialogHeader>
          {manifestLoad && (
            <div className="space-y-4 mt-2">
              {/* Header */}
              <div className="flex items-start gap-3 border-b border-[#1A4331]/10 pb-3">
                <img src={WC_LOGO} alt="WC" className="h-10 object-contain" />
                <div>
                  <p className="font-semibold text-[#0A1711]">{manifestLoad.driver_name}</p>
                  <p className="text-xs text-[#4A5D53]">{fmtDate(manifestLoad.departure_date)} &middot; {manifestLoad.destinations?.map(d => d.address).join(', ')}</p>
                </div>
              </div>

              {/* Tickable pallets */}
              <div className="space-y-2">
                {mPallets.map((p, i) => (
                  <div key={i} onClick={() => toggleCheck(i)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none active:scale-[0.98] ${checkedItems[i] ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                    data-testid={`check-${i}`}>
                    <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${checkedItems[i] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 text-transparent'}`}>
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_HEX[p.color] || '#1A4331' }} />
                    <span className={`text-sm font-semibold capitalize flex-1 ${checkedItems[i] ? 'line-through text-[#4A5D53]' : ''}`}>{p.color}</span>
                    <span className="text-lg font-bold">{p.quantity}</span>
                    <span className="text-xs text-[#4A5D53]">pallets</span>
                  </div>
                ))}
              </div>

              {!allChecked && mPallets.length > 0 && <p className="text-xs text-amber-600">Tap each row to check off with the driver</p>}
              {allChecked && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"><p className="text-sm text-emerald-800 font-medium">All checked — fill in driver details and sign below</p></div>}

              {/* Driver details + signature */}
              <div className="border-t border-[#1A4331]/10 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-[#4A5D53] font-bold uppercase tracking-wider">Driver Name</Label>
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Full name" className="mt-1" data-testid="driver-name-input" />
                  </div>
                  <div>
                    <Label className="text-xs text-[#4A5D53] font-bold uppercase tracking-wider">Registration</Label>
                    <Input value={registration} onChange={e => setRegistration(e.target.value)} placeholder="e.g. AB12 CDE" className="mt-1" data-testid="registration-input" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-[#4A5D53] font-bold uppercase tracking-wider flex items-center gap-1"><PenTool className="w-3 h-3" /> Signature</Label>
                  <div className="mt-1"><SignaturePad onSave={handleSign} /></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Signed Manifest Dialog ── */}
      <Dialog open={!!showViewManifest} onOpenChange={(open) => { if (!open) { setShowViewManifest(null); setManifestLoad(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="view-manifest-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Signed Manifest</DialogTitle></DialogHeader>
          {manifestLoad && (
            <div className="space-y-4 mt-2">
              <div className="flex items-start gap-3 border-b border-[#1A4331]/10 pb-3">
                <img src={WC_LOGO} alt="WC" className="h-10 object-contain" />
                <div className="flex-1">
                  <p className="font-semibold text-[#0A1711]">{manifestLoad.driver_name}</p>
                  <p className="text-xs text-[#4A5D53]">{fmtDate(manifestLoad.departure_date)} &middot; Ref: WC-{showViewManifest?.slice(-6).toUpperCase()}</p>
                </div>
              </div>

              {/* Destinations */}
              {manifestLoad.destinations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#1A4331] uppercase tracking-wider mb-1">Destinations</h4>
                  {manifestLoad.destinations.map((d, i) => (
                    <p key={i} className="text-sm text-[#0A1711] flex items-center gap-1.5 py-0.5"><MapPin className="w-3 h-3 text-[#E27B58]" /> {d.address}</p>
                  ))}
                </div>
              )}

              {/* Pallets */}
              <div>
                <h4 className="text-xs font-bold text-[#1A4331] uppercase tracking-wider mb-2">Pallets</h4>
                {(manifestLoad.pallets_required || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_HEX[p.color] || '#1A4331' }} />
                    <span className="text-sm font-medium capitalize flex-1">{p.color}</span>
                    <span className="text-sm font-bold">{p.quantity} pallets</span>
                    <span className="text-xs text-[#4A5D53]">{p.quantity * 100} trees</span>
                  </div>
                ))}
              </div>

              {manifestLoad.notes && (
                <div className="bg-[#F4F1ED] rounded-lg p-3">
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Notes</span>
                  <p className="text-sm text-[#0A1711] mt-0.5">{manifestLoad.notes}</p>
                </div>
              )}

              {/* Signature */}
              {manifestLoad.signature ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-emerald-800 text-sm">Signed & Dispatched</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Driver</span>
                      <p className="font-medium">{manifestLoad.signature.driver_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Registration</span>
                      <p className="font-medium">{manifestLoad.signature.registration || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Date</span>
                      <p className="font-medium">{new Date(manifestLoad.signature.signed_at).toLocaleString('en-GB')}</p>
                    </div>
                  </div>
                  {manifestLoad.signature.signature_data && (
                    <div className="mt-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Signature</span>
                      <img src={manifestLoad.signature.signature_data} alt="Signature" className="max-h-16 mt-1" />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#4A5D53] italic">Not signed</p>
              )}

              <Button onClick={() => window.open(`/manifest/${showViewManifest}`, '_blank')} variant="outline" className="w-full border-[#1A4331]/20">
                <Printer className="w-4 h-4 mr-2" /> Print Manifest
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
