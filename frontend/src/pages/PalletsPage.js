import React, { useState, useEffect } from 'react';
import { getColours, createColour, deleteColour, getStockMovements } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Package, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };

export default function StockPage() {
  const [colours, setColours] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddColour, setShowAddColour] = useState(false);
  const [newColour, setNewColour] = useState({ color: '', label: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, movRes] = await Promise.all([getColours(), getStockMovements({ limit: 20 })]);
      setColours(colRes.data);
      setMovements(movRes.data);
    } catch { toast.error('Failed to fetch'); }
    setLoading(false);
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
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDeleteColour = async (id) => {
    try { await deleteColour(id); toast.success('Colour removed'); fetchData(); } catch { toast.error('Failed'); }
  };

  const totalStock = colours.reduce((sum, c) => sum + (c.quantity || 0), 0);

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Stock</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Current stock levels by colour</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#1A4331]/15 rounded-xl px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-[#4A5D53] font-bold">Total</span>
            <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalStock} <span className="text-sm font-normal text-[#4A5D53]">pallets</span></p>
            <p className="text-xs text-[#4A5D53]">{(totalStock * 100).toLocaleString()} trees</p>
          </div>
          <Dialog open={showAddColour} onOpenChange={setShowAddColour}>
            <DialogTrigger asChild>
              <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="add-colour-button">
                <Plus className="w-4 h-4 mr-2" /> Add Colour
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-colour-dialog">
              <DialogHeader><DialogTitle className="font-['Outfit']">Add Colour Code</DialogTitle></DialogHeader>
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLOR_HEX[c.color] || '#1A4331' }}>
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A1711] font-['Outfit'] capitalize">{c.label || c.color}</h3>
                  <p className="text-[10px] text-[#4A5D53] uppercase tracking-wider">{c.color}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDeleteColour(c.id)} className="text-red-400 hover:text-red-600" data-testid={`delete-colour-${c.color}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-4xl font-bold text-[#0A1711] font-['Outfit'] mb-1">{c.quantity || 0}</p>
            <p className="text-xs text-[#4A5D53]">{(c.quantity || 0) * 100} trees</p>
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
          <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit']">Recent Activity</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F4F1ED]/50">
              <TableHead className="font-semibold">Time</TableHead>
              <TableHead className="font-semibold">Colour</TableHead>
              <TableHead className="font-semibold">Change</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
              <TableHead className="font-semibold">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#4A5D53]">No activity yet.</TableCell></TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id} className="hover:bg-[#F4F1ED]/30">
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#4A5D53]" />{new Date(m.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold capitalize" style={{ backgroundColor: `${COLOR_HEX[m.color] || '#1A4331'}15`, color: COLOR_HEX[m.color] || '#1A4331' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_HEX[m.color] || '#1A4331' }} />
                      {m.color}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 font-bold text-sm ${m.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {m.change > 0 ? '+' : ''}{m.change}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-[#4A5D53] max-w-[200px] truncate">{m.notes}</TableCell>
                  <TableCell className="text-xs text-[#4A5D53]">{m.user_name}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
