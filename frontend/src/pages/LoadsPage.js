import React, { useState, useEffect } from 'react';
import { getLoads, createLoad, updateLoad, getManifest, getLorries, getPallets, addPalletToLoad } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Printer, Truck, BoxesIcon, MapPin, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const GRID_ROWS = ['A', 'B', 'C', 'D'];
const GRID_COLS = [1, 2, 3, 4, 5];

export default function LoadsPage() {
  const [loads, setLoads] = useState([]);
  const [lorries, setLorries] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showManifest, setShowManifest] = useState(null);
  const [manifestData, setManifestData] = useState(null);
  const [showLoadingView, setShowLoadingView] = useState(null);
  const [selectedPallet, setSelectedPallet] = useState('');
  const [form, setForm] = useState({
    lorry_id: '', destinations: [{ address: '', order_id: '', notes: '' }],
    departure_date: '', driver_name: '', notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loadRes, lorryRes, palletRes] = await Promise.all([
        getLoads(), getLorries(), getPallets({ status: 'in_yard' })
      ]);
      setLoads(loadRes.data);
      setLorries(lorryRes.data);
      setPallets(palletRes.data);
    } catch (err) {
      toast.error('Failed to fetch loads data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const addDestination = () => setForm({...form, destinations: [...form.destinations, { address: '', order_id: '', notes: '' }]});
  const removeDestination = (idx) => setForm({...form, destinations: form.destinations.filter((_, i) => i !== idx)});
  const updateDestination = (idx, field, val) => {
    const dests = [...form.destinations];
    dests[idx] = {...dests[idx], [field]: val};
    setForm({...form, destinations: dests});
  };

  const handleCreate = async () => {
    try {
      await createLoad(form);
      toast.success('Load created');
      setShowCreate(false);
      setForm({ lorry_id: '', destinations: [{ address: '' }], departure_date: '', driver_name: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to create load');
    }
  };

  const handleAddPallet = async (loadId, position) => {
    if (!selectedPallet) {
      toast.error('Select a pallet first');
      return;
    }
    try {
      await addPalletToLoad(loadId, { pallet_id: selectedPallet, position });
      toast.success(`Pallet added to position ${position}`);
      setSelectedPallet('');
      fetchData();
      // Refresh the loading view
      const { data } = await getManifest(loadId);
      setManifestData(data);
    } catch (err) {
      toast.error('Failed to add pallet');
    }
  };

  const handleStatusChange = async (loadId, status) => {
    try {
      await updateLoad(loadId, { status });
      toast.success(`Load status: ${status}`);
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

  const handleShowLoading = async (loadId) => {
    try {
      const { data } = await getManifest(loadId);
      setManifestData(data);
      setShowLoadingView(loadId);
    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  const getLorryName = (id) => lorries.find(l => l.id === id)?.name || id;

  return (
    <div className="space-y-6" data-testid="loads-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Loads</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Manage lorry loads with multiple destinations</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-load-button">
              <Plus className="w-4 h-4 mr-2" /> New Load
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="create-load-dialog">
            <DialogHeader>
              <DialogTitle className="font-['Outfit']">Create Load</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Lorry</Label>
                <Select value={form.lorry_id} onValueChange={v => setForm({...form, lorry_id: v})}>
                  <SelectTrigger data-testid="load-lorry-select"><SelectValue placeholder="Select lorry" /></SelectTrigger>
                  <SelectContent>
                    {lorries.filter(l => l.status === 'available').map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.registration})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Driver Name</Label>
                  <Input value={form.driver_name} onChange={e => setForm({...form, driver_name: e.target.value})} />
                </div>
                <div>
                  <Label>Departure Date</Label>
                  <Input type="date" value={form.departure_date} onChange={e => setForm({...form, departure_date: e.target.value})} />
                </div>
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  Destinations
                  <Button type="button" variant="ghost" size="sm" onClick={addDestination} className="text-[#1A4331]" data-testid="add-destination">
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </Label>
                <div className="space-y-3 mt-2">
                  {form.destinations.map((dest, idx) => (
                    <div key={idx} className="bg-[#F4F1ED] p-3 rounded-lg flex items-end gap-2">
                      <div className="flex-1">
                        <span className="text-xs text-[#4A5D53]">Address</span>
                        <Input value={dest.address} onChange={e => updateDestination(idx, 'address', e.target.value)} className="bg-white" placeholder="Delivery address" />
                      </div>
                      {form.destinations.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeDestination(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A4331] text-white" data-testid="submit-load-button">Create Load</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loads Table */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="loads-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F4F1ED]/50">
              <TableHead className="font-semibold">Lorry</TableHead>
              <TableHead className="font-semibold">Driver</TableHead>
              <TableHead className="font-semibold">Destinations</TableHead>
              <TableHead className="font-semibold">Pallets</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-[#4A5D53]">
                  <BoxesIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No loads yet. Create a new load.
                </TableCell>
              </TableRow>
            ) : (
              loads.map((load) => (
                <TableRow key={load.id} className="hover:bg-[#F4F1ED]/30 transition-colors">
                  <TableCell className="font-medium">{getLorryName(load.lorry_id)}</TableCell>
                  <TableCell className="text-sm">{load.driver_name || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {load.destinations?.map((d, i) => (
                        <span key={i} className="text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#E27B58]" />
                          {d.address}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{load.pallets?.length || 0}</TableCell>
                  <TableCell>
                    <span className={`status-badge ${load.status}`}>{load.status?.replace('_', ' ')}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {load.status === 'loading' && (
                        <Button variant="ghost" size="sm" onClick={() => handleShowLoading(load.id)} title="Load Pallets" data-testid={`load-pallets-${load.id}`}>
                          <BoxesIcon className="w-4 h-4 text-[#1A4331]" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleShowManifest(load.id)} title="View Manifest" data-testid={`manifest-${load.id}`}>
                        <Printer className="w-4 h-4 text-[#1A4331]" />
                      </Button>
                      {load.status === 'loading' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(load.id, 'in_transit')} title="Dispatch">
                          <span className="text-xs text-blue-600 font-medium">Dispatch</span>
                        </Button>
                      )}
                      {load.status === 'in_transit' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(load.id, 'delivered')} title="Delivered">
                          <span className="text-xs text-emerald-600 font-medium">Delivered</span>
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

      {/* Lorry Loading View Dialog */}
      <Dialog open={!!showLoadingView} onOpenChange={() => setShowLoadingView(null)}>
        <DialogContent className="sm:max-w-3xl" data-testid="lorry-loading-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Lorry Loading Map</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {/* Pallet selector */}
            <div className="flex items-center gap-3 mb-4">
              <Label className="whitespace-nowrap">Select Pallet:</Label>
              <Select value={selectedPallet} onValueChange={setSelectedPallet}>
                <SelectTrigger className="flex-1" data-testid="select-pallet-for-load"><SelectValue placeholder="Choose pallet to place" /></SelectTrigger>
                <SelectContent>
                  {pallets.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pallet_number} — {p.tree_color} {p.tree_size} (qty: {p.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            <div className="border border-[#1A4331]/20 rounded-xl p-4 bg-[#F4F1ED]">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-[#1A4331]" />
                <span className="text-xs uppercase tracking-wider font-bold text-[#4A5D53]">Lorry Bed — Click to place pallet</span>
              </div>
              <div className="grid grid-cols-5 gap-2" data-testid="lorry-grid">
                {GRID_ROWS.map(row =>
                  GRID_COLS.map(col => {
                    const pos = `${row}${col}`;
                    const loaded = manifestData?.pallets?.find(p => p.position === pos);
                    return (
                      <div
                        key={pos}
                        className={`lorry-grid-cell ${loaded ? 'occupied' : ''}`}
                        onClick={() => !loaded && showLoadingView && handleAddPallet(showLoadingView, pos)}
                        data-testid={`grid-cell-${pos}`}
                      >
                        {loaded ? (
                          <div className="text-center p-1">
                            <span className={`color-badge ${loaded.tree_color} text-[10px]`}>{loaded.tree_color}</span>
                            <p className="text-[10px] mt-0.5">{loaded.pallet_number}</p>
                          </div>
                        ) : (
                          <span className="text-[#4A5D53]/40">{pos}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-[#4A5D53]">REAR</span>
                <span className="text-[10px] text-[#4A5D53]">FRONT (CAB)</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manifest Dialog */}
      <Dialog open={!!showManifest} onOpenChange={() => { setShowManifest(null); setManifestData(null); }}>
        <DialogContent className="sm:max-w-2xl" data-testid="manifest-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Load Manifest</DialogTitle>
          </DialogHeader>
          {manifestData && (
            <div className="mt-4 space-y-4" id="manifest-print">
              <div className="border-b border-[#1A4331]/10 pb-4">
                <h2 className="text-xl font-bold font-['Outfit'] text-[#0A1711]">Wilson Contractors</h2>
                <p className="text-sm text-[#4A5D53]">Christmas Tree Delivery Manifest</p>
              </div>
              {manifestData.lorry && (
                <div className="bg-[#F4F1ED] p-3 rounded-lg">
                  <p className="text-sm"><strong>Lorry:</strong> {manifestData.lorry.name} ({manifestData.lorry.registration})</p>
                  <p className="text-sm"><strong>Driver:</strong> {manifestData.load.driver_name || '—'}</p>
                  <p className="text-sm"><strong>Date:</strong> {manifestData.load.departure_date || new Date().toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold mb-2">Destinations</h4>
                {manifestData.load.destinations?.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="text-xs bg-[#1A4331] text-white rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm">{d.address}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Pallets ({manifestData.pallets?.length || 0})</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pallet #</TableHead>
                      <TableHead>Colour</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manifestData.pallets?.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.pallet_number}</TableCell>
                        <TableCell><span className={`color-badge ${p.tree_color}`}>{p.tree_color}</span></TableCell>
                        <TableCell>{p.tree_size}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>{p.position}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
