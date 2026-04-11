import React, { useState, useEffect } from 'react';
import { getPallets, createPallet, updatePallet, deletePallet, getPalletQR } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, QrCode, Trash2, Edit, Search, Package } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['green', 'blue', 'silver'];
const SIZES = ['4ft', '5ft', '6ft', '7ft', '8ft', '10ft'];
const SPECIES = ['Nordmann Fir', 'Norway Spruce', 'Blue Spruce', 'Fraser Fir'];

export default function PalletsPage() {
  const [pallets, setPallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [filterColor, setFilterColor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    pallet_number: '', tree_color: 'green', tree_species: 'Nordmann Fir',
    tree_size: '6ft', quantity: 50, location: 'yard', yard_position: '', notes: ''
  });

  const fetchPallets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterColor) params.color = filterColor;
      if (filterStatus) params.status = filterStatus;
      const { data } = await getPallets(params);
      setPallets(data);
    } catch (err) {
      toast.error('Failed to fetch pallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPallets(); }, [filterColor, filterStatus]);

  const handleCreate = async () => {
    try {
      await createPallet(form);
      toast.success('Pallet created');
      setShowCreate(false);
      setForm({ pallet_number: '', tree_color: 'green', tree_species: 'Nordmann Fir', tree_size: '6ft', quantity: 50, location: 'yard', yard_position: '', notes: '' });
      fetchPallets();
    } catch (err) {
      toast.error('Failed to create pallet');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePallet(id);
      toast.success('Pallet deleted');
      fetchPallets();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleShowQR = async (id) => {
    try {
      const { data } = await getPalletQR(id);
      setQrData(data);
      setShowQR(id);
    } catch (err) {
      toast.error('Failed to get QR code');
    }
  };

  const filtered = pallets.filter(p =>
    !search || p.pallet_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.tree_color?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="pallets-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Pallets</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Manage all tree pallets from field to yard</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-pallet-button">
              <Plus className="w-4 h-4 mr-2" /> New Pallet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg" data-testid="create-pallet-dialog">
            <DialogHeader>
              <DialogTitle className="font-['Outfit']">Add New Pallet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pallet Number</Label>
                  <Input value={form.pallet_number} onChange={e => setForm({...form, pallet_number: e.target.value})} placeholder="e.g. P-001" data-testid="pallet-number-input" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} data-testid="pallet-quantity-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tree Colour</Label>
                  <Select value={form.tree_color} onValueChange={v => setForm({...form, tree_color: v})}>
                    <SelectTrigger data-testid="pallet-color-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLORS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tree Size</Label>
                  <Select value={form.tree_size} onValueChange={v => setForm({...form, tree_size: v})}>
                    <SelectTrigger data-testid="pallet-size-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Species</Label>
                  <Select value={form.tree_species} onValueChange={v => setForm({...form, tree_species: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SPECIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Select value={form.location} onValueChange={v => setForm({...form, location: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="field">Field</SelectItem>
                      <SelectItem value="yard">Yard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Yard Position</Label>
                <Input value={form.yard_position} onChange={e => setForm({...form, yard_position: e.target.value})} placeholder="e.g. Bay A1" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes" />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A4331] text-white hover:bg-[#1A4331]/90" data-testid="submit-pallet-button">
                Create Pallet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5D53]" />
          <Input
            placeholder="Search pallets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white border-[#1A4331]/15"
            data-testid="search-pallets"
          />
        </div>
        <Select value={filterColor} onValueChange={setFilterColor}>
          <SelectTrigger className="w-32 bg-white" data-testid="filter-color"><SelectValue placeholder="Colour" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colours</SelectItem>
            {COLORS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 bg-white" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_field">In Field</SelectItem>
            <SelectItem value="in_yard">In Yard</SelectItem>
            <SelectItem value="loading">Loading</SelectItem>
            <SelectItem value="loaded">Loaded</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pallets Table */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="pallets-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F4F1ED]/50">
              <TableHead className="font-semibold">Pallet #</TableHead>
              <TableHead className="font-semibold">Colour</TableHead>
              <TableHead className="font-semibold">Species</TableHead>
              <TableHead className="font-semibold">Size</TableHead>
              <TableHead className="font-semibold">Qty</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-[#4A5D53]">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No pallets found. Create your first pallet above.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-[#F4F1ED]/30 transition-colors">
                  <TableCell className="font-medium">{p.pallet_number}</TableCell>
                  <TableCell>
                    <span className={`color-badge ${p.tree_color}`}>{p.tree_color}</span>
                  </TableCell>
                  <TableCell className="text-sm">{p.tree_species}</TableCell>
                  <TableCell className="text-sm">{p.tree_size}</TableCell>
                  <TableCell className="font-medium">{p.quantity}</TableCell>
                  <TableCell>
                    <span className={`status-badge ${p.status}`}>{p.status?.replace('_', ' ')}</span>
                  </TableCell>
                  <TableCell className="text-sm">{p.yard_position || p.location}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleShowQR(p.id)} data-testid={`qr-pallet-${p.id}`}>
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700" data-testid={`delete-pallet-${p.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={!!showQR} onOpenChange={() => { setShowQR(null); setQrData(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="qr-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Pallet QR Code</DialogTitle>
          </DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center py-4">
              <img src={`data:image/png;base64,${qrData.qr_base64}`} alt="QR Code" className="w-48 h-48" />
              <p className="mt-3 text-xs text-[#4A5D53] text-center break-all">{qrData.qr_data}</p>
              <Button className="mt-4 bg-[#1A4331] text-white" onClick={() => window.print()} data-testid="print-qr-button">
                Print QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
