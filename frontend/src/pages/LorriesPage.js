import React, { useState, useEffect } from 'react';
import { getLorries, createLorry, deleteLorry } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function LorriesPage() {
  const [lorries, setLorries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ registration: '', name: '', capacity: 20 });

  const fetchLorries = async () => {
    setLoading(true);
    try {
      const { data } = await getLorries();
      setLorries(data);
    } catch (err) {
      toast.error('Failed to fetch lorries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLorries(); }, []);

  const handleCreate = async () => {
    try {
      await createLorry(form);
      toast.success('Lorry added');
      setShowCreate(false);
      setForm({ registration: '', name: '', capacity: 20 });
      fetchLorries();
    } catch (err) {
      toast.error('Failed to create lorry');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteLorry(id);
      toast.success('Lorry deleted');
      fetchLorries();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const statusColors = {
    available: 'bg-emerald-100 text-emerald-800',
    loading: 'bg-blue-100 text-blue-800',
    in_transit: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6" data-testid="lorries-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Lorries</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Manage your fleet of lorries</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-lorry-button">
              <Plus className="w-4 h-4 mr-2" /> Add Lorry
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="create-lorry-dialog">
            <DialogHeader>
              <DialogTitle className="font-['Outfit']">Add Lorry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Lorry 1" data-testid="lorry-name-input" />
              </div>
              <div>
                <Label>Registration</Label>
                <Input value={form.registration} onChange={e => setForm({...form, registration: e.target.value})} placeholder="e.g. AB12 CDE" data-testid="lorry-reg-input" />
              </div>
              <div>
                <Label>Pallet Capacity</Label>
                <Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 0})} data-testid="lorry-capacity-input" />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A4331] text-white" data-testid="submit-lorry-button">Add Lorry</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lorries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="lorries-grid">
        {lorries.map((lorry) => (
          <div key={lorry.id} className="bg-white border border-[#1A4331]/15 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" data-testid={`lorry-card-${lorry.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1A4331]/10 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-[#1A4331]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A1711] font-['Outfit']">{lorry.name}</h3>
                  <p className="text-xs text-[#4A5D53]">{lorry.registration}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(lorry.id)} className="text-red-400 hover:text-red-600" data-testid={`delete-lorry-${lorry.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#4A5D53]">Capacity: {lorry.capacity} pallets</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${statusColors[lorry.status] || 'bg-gray-100 text-gray-600'}`}>
                {lorry.status?.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
        {lorries.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center py-12 text-[#4A5D53]">
            <Truck className="w-8 h-8 mb-2 opacity-40" />
            <p>No lorries added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
