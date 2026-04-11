import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getYardLocations, createYardLocation, deleteYardLocation, getColours } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash2, MapPin, Package, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const YARD_CENTER = [57.150, -2.500]; // Mains of Corsindae
const COLOR_BG = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04' };

// Bay colours for the map
const BAY_COLORS = ['#16a34a', '#2563eb', '#dc2626', '#ca8a04', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function DrawBayTool({ isDrawing, onBayDrawn }) {
  const [start, setStart] = useState(null);
  const [current, setCurrent] = useState(null);

  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      if (!start) {
        setStart(e.latlng);
      } else {
        onBayDrawn([
          [Math.min(start.lat, e.latlng.lat), Math.min(start.lng, e.latlng.lng)],
          [Math.max(start.lat, e.latlng.lat), Math.max(start.lng, e.latlng.lng)]
        ]);
        setStart(null);
        setCurrent(null);
      }
    },
    mousemove(e) {
      if (isDrawing && start) {
        setCurrent(e.latlng);
      }
    }
  });

  if (start && current) {
    return (
      <Rectangle
        bounds={[
          [Math.min(start.lat, current.lat), Math.min(start.lng, current.lng)],
          [Math.max(start.lat, current.lat), Math.max(start.lng, current.lng)]
        ]}
        pathOptions={{ color: '#1A4331', weight: 2, fillOpacity: 0.2, dashArray: '5,5' }}
      />
    );
  }
  return null;
}

function BayRectangle({ bay, onDelete, stock, colours }) {
  if (!bay.bounds) return null;
  const bounds = bay.bounds;
  const colorIdx = bay.colorIndex || 0;
  const bayColor = BAY_COLORS[colorIdx % BAY_COLORS.length];

  // Calculate stock in this bay
  const bayStock = stock || bay.current_stock || 0;

  // Get colour breakdown for this bay
  const colourBreakdown = colours?.filter(c => c.quantity > 0) || [];

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        color: bayColor,
        weight: 3,
        fillColor: bayColor,
        fillOpacity: bayStock > 0 ? 0.35 : 0.15,
      }}
    >
      <Popup>
        <div className="min-w-[160px]">
          <h3 className="font-bold text-base font-['Outfit'] mb-1">{bay.name}</h3>
          <p className="text-xs text-gray-500 mb-2">Section {bay.section}</p>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">Pallets:</span>
            <span className="text-lg font-bold">{bayStock} / {bay.capacity}</span>
          </div>
          <div className="text-xs text-gray-500 mb-2">{bayStock * 100} trees</div>
          {bay.description && <p className="text-xs text-gray-600 mb-2">{bay.description}</p>}
          <button
            onClick={() => onDelete(bay.id)}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 mt-1"
          >
            <Trash2 size={12} /> Remove Bay
          </button>
        </div>
      </Popup>
    </Rectangle>
  );
}

function BayLabel({ bay, stock }) {
  const map = useMap();
  const markerRef = useRef(null);

  if (!bay.bounds) return null;

  const center = [
    (bay.bounds[0][0] + bay.bounds[1][0]) / 2,
    (bay.bounds[0][1] + bay.bounds[1][1]) / 2,
  ];

  const bayStock = stock || bay.current_stock || 0;

  const icon = L.divIcon({
    className: 'bay-label-icon',
    html: `<div style="
      background: rgba(255,255,255,0.95);
      border: 2px solid #1A4331;
      border-radius: 8px;
      padding: 4px 8px;
      text-align: center;
      font-family: Outfit, sans-serif;
      min-width: 60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    ">
      <div style="font-size: 10px; font-weight: 600; color: #1A4331; text-transform: uppercase; letter-spacing: 0.5px;">${bay.name}</div>
      <div style="font-size: 18px; font-weight: 800; color: #0A1711;">${bayStock}</div>
      <div style="font-size: 9px; color: #4A5D53;">pallets</div>
    </div>`,
    iconSize: [80, 60],
    iconAnchor: [40, 30],
  });

  return <Marker position={center} icon={icon} ref={markerRef} />;
}

export default function YardPage() {
  const [locations, setLocations] = useState([]);
  const [colours, setColours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pendingBounds, setPendingBounds] = useState(null);
  const [form, setForm] = useState({ name: '', section: 'A', capacity: 20, description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locRes, colRes] = await Promise.all([getYardLocations(), getColours()]);
      setLocations(locRes.data);
      setColours(colRes.data);
    } catch (err) {
      toast.error('Failed to fetch yard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBayDrawn = (bounds) => {
    setPendingBounds(bounds);
    setIsDrawing(false);
    setShowCreateDialog(true);
  };

  const handleCreateBay = async () => {
    if (!form.name.trim()) return toast.error('Enter a bay name');
    try {
      const bayData = {
        ...form,
        bounds: pendingBounds,
        colorIndex: locations.length
      };
      await createYardLocation(bayData);
      toast.success(`Bay "${form.name}" created`);
      setShowCreateDialog(false);
      setPendingBounds(null);
      setForm({ name: '', section: 'A', capacity: 20, description: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to create bay');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteYardLocation(id);
      toast.success('Bay removed');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const totalStock = colours.reduce((sum, c) => sum + (c.quantity || 0), 0);

  return (
    <div className="space-y-6" data-testid="yard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Yard Map</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Mains of Corsindae — draw bays on the map to track stock</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#1A4331]/15 rounded-xl px-4 py-2">
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Total</span>
            <p className="text-lg font-bold text-[#0A1711] font-['Outfit']">{totalStock} pallets</p>
          </div>
          <Button
            onClick={() => setIsDrawing(!isDrawing)}
            className={`rounded-lg ${isDrawing ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1A4331] hover:bg-[#1A4331]/90'} text-white`}
            data-testid="draw-bay-button"
          >
            {isDrawing ? (
              <><X className="w-4 h-4 mr-2" /> Cancel Drawing</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" /> Draw Bay</>
            )}
          </Button>
        </div>
      </div>

      {isDrawing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Drawing mode:</strong> Click two corners on the map to draw a bay rectangle. Click the first corner, then the opposite corner.
        </div>
      )}

      {/* Map */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" style={{ height: '500px' }} data-testid="yard-map">
        <MapContainer
          center={YARD_CENTER}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri"
            maxZoom={19}
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />

          <DrawBayTool isDrawing={isDrawing} onBayDrawn={handleBayDrawn} />

          {locations.map((loc) => (
            <React.Fragment key={loc.id}>
              <BayRectangle bay={loc} onDelete={handleDelete} stock={loc.current_stock} colours={colours} />
              <BayLabel bay={loc} stock={loc.current_stock} />
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stock-overview">
        {colours.map((c) => (
          <div key={c.id} className="bg-white border border-[#1A4331]/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_BG[c.color] || '#1A4331' }} />
              <span className="text-sm font-semibold capitalize text-[#0A1711]">{c.label || c.color}</span>
            </div>
            <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{c.quantity || 0}</p>
            <p className="text-xs text-[#4A5D53]">{(c.quantity || 0) * 100} trees</p>
          </div>
        ))}
        {colours.length === 0 && !loading && (
          <div className="col-span-full text-center py-6 text-[#4A5D53] text-sm">
            No colours set up yet. Add colours on the Stock page first.
          </div>
        )}
      </div>

      {/* Bay List */}
      {locations.length > 0 && (
        <div className="bg-white border border-[#1A4331]/15 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Bays ({locations.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map((loc, idx) => {
              const bayColor = BAY_COLORS[idx % BAY_COLORS.length];
              const utilisation = loc.capacity > 0 ? Math.round(((loc.current_stock || 0) / loc.capacity) * 100) : 0;
              return (
                <div key={loc.id} className="bg-[#F4F1ED] rounded-xl p-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: bayColor }} />
                    <div>
                      <h4 className="font-semibold text-sm text-[#0A1711]">{loc.name}</h4>
                      <p className="text-xs text-[#4A5D53]">Section {loc.section} &middot; Capacity: {loc.capacity}</p>
                      <p className="text-xs font-bold text-[#0A1711] mt-1">{loc.current_stock || 0} pallets ({utilisation}%)</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Bay Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setPendingBounds(null); } }}>
        <DialogContent data-testid="create-bay-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Name This Bay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Bay Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bay A1, North Row" data-testid="bay-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Section</Label>
                <Input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="A" />
              </div>
              <div>
                <Label>Capacity (pallets)</Label>
                <Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Near entrance gate" />
            </div>
            <Button onClick={handleCreateBay} className="w-full bg-[#1A4331] text-white" data-testid="submit-bay-button">Create Bay</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
