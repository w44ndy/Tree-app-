import React, { useState, useEffect } from 'react';
import { getYardLocations, createYardLocation, deleteYardLocation, getPallets } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, MapPin, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

const COLOR_BG = { green: 'bg-emerald-500', blue: 'bg-blue-500', silver: 'bg-gray-400' };

export default function YardPage() {
  const [locations, setLocations] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', section: 'A', capacity: 20, description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locRes, palRes] = await Promise.all([getYardLocations(), getPallets({ status: 'in_yard' })]);
      setLocations(locRes.data);
      setPallets(palRes.data);
    } catch (err) {
      toast.error('Failed to fetch yard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    try {
      await createYardLocation(form);
      toast.success('Location created');
      setShowCreate(false);
      setForm({ name: '', section: 'A', capacity: 20, description: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to create location');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteYardLocation(id);
      toast.success('Location deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  // Group pallets by color for overview
  const colorSummary = {};
  pallets.forEach(p => {
    const key = p.tree_color || 'unknown';
    if (!colorSummary[key]) colorSummary[key] = { count: 0, quantity: 0 };
    colorSummary[key].count += 1;
    colorSummary[key].quantity += p.quantity || 0;
  });

  return (
    <div className="space-y-6" data-testid="yard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Yard & Stock</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Mains of Corsindae — Stock overview and yard locations</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-location-button">
              <Plus className="w-4 h-4 mr-2" /> New Location
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="create-location-dialog">
            <DialogHeader>
              <DialogTitle className="font-['Outfit']">Add Yard Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Bay A1" data-testid="location-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Section</Label>
                  <Input value={form.section} onChange={e => setForm({...form, section: e.target.value})} placeholder="A" />
                </div>
                <div>
                  <Label>Capacity</Label>
                  <Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional" />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A4331] text-white" data-testid="submit-location-button">Create Location</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Overview */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl p-6" data-testid="stock-overview">
        <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Stock Overview (In Yard)</h3>
        {Object.keys(colorSummary).length === 0 ? (
          <p className="text-[#4A5D53] text-sm">No pallets in yard yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(colorSummary).map(([color, data]) => (
              <div key={color} className="bg-[#F4F1ED] rounded-xl p-4 border border-[#1A4331]/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${COLOR_BG[color] || 'bg-gray-400'}`} />
                  <span className="text-sm font-semibold capitalize text-[#0A1711]">{color}</span>
                </div>
                <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{data.quantity}</p>
                <p className="text-xs text-[#4A5D53]">{data.count} pallets</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yard Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="yard-locations-grid">
        {locations.map((loc) => {
          const utilisation = loc.capacity > 0 ? Math.round((loc.current_stock / loc.capacity) * 100) : 0;
          return (
            <div key={loc.id} className="bg-white border border-[#1A4331]/15 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" data-testid={`yard-location-${loc.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1A4331]" />
                  <span className="font-semibold text-[#0A1711] font-['Outfit']">{loc.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)} className="text-red-400 hover:text-red-600" data-testid={`delete-location-${loc.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-[#4A5D53] mb-3">Section {loc.section} {loc.description ? `— ${loc.description}` : ''}</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#4A5D53]">Capacity</span>
                <span className="text-xs font-semibold">{loc.current_stock}/{loc.capacity}</span>
              </div>
              <div className="w-full h-2 bg-[#F4F1ED] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(utilisation, 100)}%`,
                    backgroundColor: utilisation > 80 ? '#DC2626' : utilisation > 50 ? '#EAB308' : '#286646'
                  }}
                />
              </div>
            </div>
          );
        })}
        {locations.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center py-12 text-[#4A5D53]">
            <Package className="w-8 h-8 mb-2 opacity-40" />
            <p>No yard locations configured. Add locations to track stock.</p>
          </div>
        )}
      </div>
    </div>
  );
}
