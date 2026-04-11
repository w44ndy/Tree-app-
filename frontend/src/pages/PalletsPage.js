import React, { useState, useEffect } from 'react';
import { getColours, createColour, deleteColour, adjustStock, getStockMovements, getColourQR } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Minus, QrCode, Trash2, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_BG = {
  green: 'bg-emerald-500', blue: 'bg-blue-500', silver: 'bg-gray-400',
  red: 'bg-red-500', gold: 'bg-amber-500', white: 'bg-gray-200'
};

export default function StockPage() {
  const [colours, setColours] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddColour, setShowAddColour] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [showAdjust, setShowAdjust] = useState(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [newColour, setNewColour] = useState({ color: '', label: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, movRes] = await Promise.all([getColours(), getStockMovements({ limit: 20 })]);
      setColours(colRes.data);
      setMovements(movRes.data);
    } catch (err) {
      toast.error('Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddColour = async () => {
    if (!newColour.color.trim()) return toast.error('Enter a colour name');
    try {
      await createColour(newColour);
      toast.success('Colour added');
      setShowAddColour(false);
      setNewColour({ color: '', label: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleDeleteColour = async (id) => {
    try {
      await deleteColour(id);
      toast.success('Colour removed');
      fetchData();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const handleAdjust = async (color, direction) => {
    const change = direction === 'in' ? Math.abs(adjustQty) : -Math.abs(adjustQty);
    try {
      const { data } = await adjustStock({ color, change, notes: adjustNotes });
      toast.success(`${color}: ${change > 0 ? '+' : ''}${change} pallets (now ${data.quantity})`);
      setShowAdjust(null);
      setAdjustQty(1);
      setAdjustNotes('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Not enough stock');
    }
  };

  const handleShowQR = async (color) => {
    try {
      const { data } = await getColourQR(color);
      setQrData(data);
      setShowQR(color);
    } catch (err) {
      toast.error('Failed to get QR');
    }
  };

  const totalStock = colours.reduce((sum, c) => sum + (c.quantity || 0), 0);

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Stock</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Track pallets by colour — scan QR to adjust</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#1A4331]/15 rounded-xl px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-[#4A5D53] font-bold">Total Stock</span>
            <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalStock}</p>
          </div>
          <Dialog open={showAddColour} onOpenChange={setShowAddColour}>
            <DialogTrigger asChild>
              <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="add-colour-button">
                <Plus className="w-4 h-4 mr-2" /> Add Colour
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-colour-dialog">
              <DialogHeader>
                <DialogTitle className="font-['Outfit']">Add Colour Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Colour Name</Label>
                  <Input value={newColour.color} onChange={e => setNewColour({...newColour, color: e.target.value})} placeholder="e.g. green" data-testid="colour-name-input" />
                </div>
                <div>
                  <Label>Display Label (optional)</Label>
                  <Input value={newColour.label} onChange={e => setNewColour({...newColour, label: e.target.value})} placeholder="e.g. Nordmann Green" />
                </div>
                <Button onClick={handleAddColour} className="w-full bg-[#1A4331] text-white" data-testid="submit-colour-button">Add Colour</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Colour Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="colour-cards">
        {colours.map((c) => (
          <div key={c.id} className="bg-white border border-[#1A4331]/15 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" data-testid={`colour-card-${c.color}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${COLOR_BG[c.color] || 'bg-[#1A4331]'} flex items-center justify-center`}>
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A1711] font-['Outfit'] capitalize">{c.label || c.color}</h3>
                  <p className="text-[10px] text-[#4A5D53] uppercase tracking-wider">{c.color}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleShowQR(c.color)} title="QR Code" data-testid={`qr-${c.color}`}>
                  <QrCode className="w-4 h-4 text-[#1A4331]" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteColour(c.id)} className="text-red-400 hover:text-red-600" data-testid={`delete-colour-${c.color}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <p className="text-4xl font-bold text-[#0A1711] font-['Outfit'] mb-4">{c.quantity || 0}</p>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => { setShowAdjust({ color: c.color, direction: 'in' }); setAdjustQty(1); }}
                className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg h-10"
                data-testid={`add-stock-${c.color}`}
              >
                <Plus className="w-4 h-4 mr-1" /> Pallets In
              </Button>
              <Button
                onClick={() => { setShowAdjust({ color: c.color, direction: 'out' }); setAdjustQty(1); }}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 rounded-lg h-10"
                data-testid={`remove-stock-${c.color}`}
              >
                <Minus className="w-4 h-4 mr-1" /> Pallets Out
              </Button>
            </div>
          </div>
        ))}
        {colours.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center py-12 text-[#4A5D53]">
            <Package className="w-8 h-8 mb-2 opacity-40" />
            <p>No colours set up yet. Add your first colour code.</p>
          </div>
        )}
      </div>

      {/* Recent Movements */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="movements-table">
        <div className="px-6 py-4 border-b border-[#1A4331]/10">
          <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit']">Recent Movements</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F4F1ED]/50">
              <TableHead className="font-semibold">Time</TableHead>
              <TableHead className="font-semibold">Colour</TableHead>
              <TableHead className="font-semibold">Change</TableHead>
              <TableHead className="font-semibold">After</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
              <TableHead className="font-semibold">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-[#4A5D53]">No movements yet.</TableCell>
              </TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id} className="hover:bg-[#F4F1ED]/30">
                  <TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${m.color === 'green' ? 'bg-emerald-100 text-emerald-800' : m.color === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                      {m.color}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 font-bold ${m.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {m.change > 0 ? '+' : ''}{m.change}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{m.quantity_after}</TableCell>
                  <TableCell className="text-sm text-[#4A5D53] max-w-[200px] truncate">{m.notes}</TableCell>
                  <TableCell className="text-xs text-[#4A5D53]">{m.user_name}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!showAdjust} onOpenChange={() => setShowAdjust(null)}>
        <DialogContent data-testid="adjust-stock-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] capitalize">
              {showAdjust?.direction === 'in' ? 'Pallets In' : 'Pallets Out'} — {showAdjust?.color}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value) || 1)} data-testid="adjust-qty-input" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder={showAdjust?.direction === 'in' ? 'e.g. Arrived from field' : 'e.g. Loaded onto Lorry 1'} />
            </div>
            <Button
              onClick={() => handleAdjust(showAdjust?.color, showAdjust?.direction)}
              className={`w-full ${showAdjust?.direction === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
              data-testid="confirm-adjust-button"
            >
              {showAdjust?.direction === 'in' ? `+ Add ${adjustQty} Pallets` : `- Remove ${adjustQty} Pallets`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!showQR} onOpenChange={() => { setShowQR(null); setQrData(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="qr-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] capitalize">{showQR} — QR Code</DialogTitle>
          </DialogHeader>
          {qrData && (
            <div className="flex flex-col items-center py-4">
              <img src={`data:image/png;base64,${qrData.qr_base64}`} alt="QR Code" className="w-48 h-48" />
              <p className="mt-2 text-sm font-semibold capitalize">{qrData.label}</p>
              <p className="text-xs text-[#4A5D53] mt-1">{qrData.qr_data}</p>
              <p className="text-[10px] text-[#4A5D53] mt-2">Print on rolls — stick one per pallet</p>
              <Button onClick={() => window.print()} className="mt-4 bg-[#1A4331] text-white" data-testid="print-qr-button">
                Print QR Labels
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
