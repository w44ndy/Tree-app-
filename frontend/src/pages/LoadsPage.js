import React, { useState, useEffect } from 'react';
import { getLoads, createLoad, updateLoad, getManifest, getColours } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Printer, Truck, MapPin, Calendar, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoadsPage() {
  const [loads, setLoads] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showManifest, setShowManifest] = useState(null);
  const [manifestData, setManifestData] = useState(null);
  const [form, setForm] = useState({
    company_name: '',
    driver_name: '',
    registration: '',
    collection_date: '',
    destinations: [{ address: '' }],
    pallets: [{ color: '', quantity: 1 }],
    notes: ''
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

  // Destinations
  const addDest = () => setForm({ ...form, destinations: [...form.destinations, { address: '' }] });
  const removeDest = (idx) => setForm({ ...form, destinations: form.destinations.filter((_, i) => i !== idx) });
  const updateDest = (idx, val) => {
    const d = [...form.destinations];
    d[idx] = { address: val };
    setForm({ ...form, destinations: d });
  };

  // Pallet requirements
  const addPalletReq = () => setForm({ ...form, pallets: [...form.pallets, { color: '', quantity: 1 }] });
  const removePalletReq = (idx) => setForm({ ...form, pallets: form.pallets.filter((_, i) => i !== idx) });
  const updatePalletReq = (idx, field, val) => {
    const p = [...form.pallets];
    p[idx] = { ...p[idx], [field]: field === 'quantity' ? parseInt(val) || 1 : val };
    setForm({ ...form, pallets: p });
  };

  const handleCreate = async () => {
    if (!form.company_name.trim()) return toast.error('Enter company name');
    try {
      await createLoad({
        lorry_id: 'external',
        driver_name: `${form.company_name}${form.driver_name ? ' — ' + form.driver_name : ''}${form.registration ? ' (' + form.registration + ')' : ''}`,
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
      toast.error('Failed to create collection');
    }
  };

  const handleStatusChange = async (loadId, status) => {
    try {
      await updateLoad(loadId, { status });
      toast.success(`Status: ${status.replace('_', ' ')}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleShowManifest = async (loadId) => {
    try {
      const { data } = await getManifest(loadId);
      setManifestData(data);
      setShowManifest(loadId);
    } catch (err) {
      toast.error('Failed to get manifest');
    }
  };

  const totalPallets = (load) => {
    const fromPallets = load.pallets?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
    const fromReq = load.pallets_required?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
    return fromPallets + fromReq;
  };

  const statusActions = {
    loading: { next: 'in_transit', label: 'Dispatch', color: 'text-blue-600' },
    in_transit: { next: 'delivered', label: 'Delivered', color: 'text-emerald-600' }
  };

  return (
    <div className="space-y-6" data-testid="loads-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Collections</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Schedule lorry collections — who's coming, when, what they need</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-load-button">
              <Plus className="w-4 h-4 mr-2" /> New Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="create-load-dialog">
            <DialogHeader>
              <DialogTitle className="font-['Outfit']">Schedule Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Company Info */}
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

              {/* Destinations */}
              <div>
                <Label className="flex items-center justify-between">
                  Destination(s)
                  <Button type="button" variant="ghost" size="sm" onClick={addDest} className="text-[#1A4331]" data-testid="add-destination">
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </Label>
                <div className="space-y-2 mt-2">
                  {form.destinations.map((dest, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input value={dest.address} onChange={e => updateDest(idx, e.target.value)} className="flex-1" placeholder="Delivery address" />
                      {form.destinations.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeDest(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pallet Requirements */}
              <div>
                <Label className="flex items-center justify-between">
                  Pallets Required
                  <Button type="button" variant="ghost" size="sm" onClick={addPalletReq} className="text-[#1A4331]" data-testid="add-pallet-req">
                    <Plus className="w-3 h-3 mr-1" /> Add Colour
                  </Button>
                </Label>
                <div className="space-y-2 mt-2">
                  {form.pallets.map((p, idx) => (
                    <div key={idx} className="flex items-end gap-2 bg-[#F4F1ED] p-3 rounded-lg">
                      <div className="flex-1">
                        <span className="text-xs text-[#4A5D53]">Colour</span>
                        <Select value={p.color} onValueChange={v => updatePalletReq(idx, 'color', v)}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {colours.map(c => (
                              <SelectItem key={c.color} value={c.color} className="capitalize">
                                {c.label || c.color} (stock: {c.quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <span className="text-xs text-[#4A5D53]">Pallets</span>
                        <Input type="number" min={1} value={p.quantity} onChange={e => updatePalletReq(idx, 'quantity', e.target.value)} className="bg-white" />
                      </div>
                      {form.pallets.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removePalletReq(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  ))}
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

      {/* Collections Table */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="loads-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F4F1ED]/50">
              <TableHead className="font-semibold">Company / Driver</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Destination(s)</TableHead>
              <TableHead className="font-semibold">Pallets</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-[#4A5D53]">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No collections scheduled yet.
                </TableCell>
              </TableRow>
            ) : (
              loads.map((load) => (
                <TableRow key={load.id} className="hover:bg-[#F4F1ED]/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#4A5D53]" />
                      <span className="font-medium">{load.driver_name || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-3 h-3 text-[#4A5D53]" />
                      {load.departure_date || '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {load.destinations?.map((d, i) => (
                        <span key={i} className="text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#E27B58]" />
                          {d.address}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {load.pallets_required?.map((p, i) => (
                        <span key={i} className={`color-badge ${p.color}`}>{p.quantity}x {p.color}</span>
                      ))}
                      {load.pallets?.map((p, i) => (
                        <span key={`l${i}`} className={`color-badge ${p.color}`}>{p.quantity}x {p.color}</span>
                      ))}
                      {!load.pallets_required?.length && !load.pallets?.length && (
                        <span className="text-xs text-[#4A5D53]">{totalPallets(load) || '—'}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`status-badge ${load.status}`}>{load.status?.replace('_', ' ')}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleShowManifest(load.id)} title="View Manifest" data-testid={`manifest-${load.id}`}>
                        <Printer className="w-4 h-4 text-[#1A4331]" />
                      </Button>
                      {statusActions[load.status] && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(load.id, statusActions[load.status].next)}>
                          <span className={`text-xs font-medium ${statusActions[load.status].color}`}>{statusActions[load.status].label}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Manifest Dialog */}
      <Dialog open={!!showManifest} onOpenChange={() => { setShowManifest(null); setManifestData(null); }}>
        <DialogContent className="sm:max-w-2xl" data-testid="manifest-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Collection Manifest</DialogTitle>
          </DialogHeader>
          {manifestData && (
            <div className="mt-4 space-y-4" id="manifest-print">
              <div className="flex items-center gap-3 border-b border-[#1A4331]/10 pb-4">
                <img src="https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png" alt="Wilson Contractors" className="h-10 object-contain" />
                <div>
                  <h2 className="text-xl font-bold font-['Outfit'] text-[#0A1711]">Wilson Contractors</h2>
                  <p className="text-sm text-[#4A5D53]">Tree Management System — Collection Manifest</p>
                </div>
              </div>
              <div className="bg-[#F4F1ED] p-3 rounded-lg">
                <p className="text-sm"><strong>Company / Driver:</strong> {manifestData.load.driver_name || '—'}</p>
                <p className="text-sm"><strong>Date:</strong> {manifestData.load.departure_date || new Date().toLocaleDateString()}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Destination(s)</h4>
                {manifestData.load.destinations?.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="text-xs bg-[#1A4331] text-white rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm">{d.address}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Pallets</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colour</TableHead>
                      <TableHead>Pallets</TableHead>
                      <TableHead>Trees (x100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(manifestData.load.pallets_required || manifestData.pallets || []).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell><span className={`color-badge ${p.color}`}>{p.color}</span></TableCell>
                        <TableCell className="font-medium">{p.quantity}</TableCell>
                        <TableCell>{(p.quantity || 0) * 100}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {manifestData.load.notes && (
                <div className="bg-[#F4F1ED] p-3 rounded-lg">
                  <p className="text-sm"><strong>Notes:</strong> {manifestData.load.notes}</p>
                </div>
              )}
              <Button onClick={() => window.print()} className="bg-[#1A4331] text-white no-print" data-testid="print-manifest-button">
                <Printer className="w-4 h-4 mr-2" /> Print Manifest
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
