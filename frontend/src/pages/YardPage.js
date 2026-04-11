import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getYardLocations, createYardLocation, deleteYardLocation, getColours, getTotalCollected } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash2, MapPin, Package, X, TreePine, TruckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Polygon, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const YARD_CENTER = [57.17207, -2.518344];
const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };

// Lock the map completely — no pan, no zoom, nothing
function LockMap() {
  const map = useMap();
  useEffect(() => {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();
  }, [map]);
  return null;
}

function BayPolygon({ bay }) {
  const positions = bay.polygon;
  if (!positions || positions.length < 3) return null;
  const col = COLOR_HEX[bay.bay_color] || '#1A4331';
  return <Polygon positions={positions} pathOptions={{ color: col, weight: 3, fillColor: col, fillOpacity: 0.3 }} />;
}

function BayLabel({ bay }) {
  const positions = bay.polygon;
  if (!positions || positions.length < 3) return null;
  const center = positions.reduce((a, p) => [a[0] + p[0] / positions.length, a[1] + p[1] / positions.length], [0, 0]);
  const col = COLOR_HEX[bay.bay_color] || '#1A4331';
  const stock = bay.current_stock || 0;
  const icon = L.divIcon({
    className: 'bay-label',
    html: `<div style="background:rgba(255,255,255,0.95);border:2px solid ${col};border-radius:8px;padding:3px 8px;text-align:center;font-family:Outfit,sans-serif;min-width:60px;box-shadow:0 2px 6px rgba(0,0,0,0.2);pointer-events:none;">
      <div style="font-size:9px;font-weight:700;color:${col};text-transform:uppercase;letter-spacing:0.5px;">${bay.name}</div>
      <div style="font-size:18px;font-weight:800;color:#0A1711;line-height:1.1;">${stock}</div>
      <div style="font-size:8px;color:#4A5D53;">${bay.bay_color || ''}</div>
    </div>`,
    iconSize: [80, 56],
    iconAnchor: [40, 28],
  });
  return <Marker position={center} icon={icon} interactive={false} />;
}

function PinMarkers({ points }) {
  return points.map((p, i) => {
    const icon = L.divIcon({
      className: 'pin-marker',
      html: `<div style="width:20px;height:20px;background:#1A4331;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">${i + 1}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    return <Marker key={i} position={p} icon={icon} />;
  });
}

function DrawPreview({ points }) {
  if (points.length < 2) return null;
  return <Polygon positions={points} pathOptions={{ color: '#1A4331', weight: 2, fillOpacity: 0.15, dashArray: '6,4' }} />;
}

export default function YardPage() {
  const [locations, setLocations] = useState([]);
  const [colours, setColours] = useState([]);
  const [collected, setCollected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: '', section: 'A', capacity: 20, description: '', bay_color: '' });
  const drawPointsRef = useRef([]);
  const mapRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locRes, colRes, collRes] = await Promise.all([getYardLocations(), getColours(), getTotalCollected()]);
      setLocations(locRes.data);
      setColours(colRes.data);
      setCollected(collRes.data);
    } catch { toast.error('Failed to fetch yard data'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Handle taps on the overlay when drawing
  const handleOverlayTap = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!mapRef.current) return;

    let clientX, clientY;
    if (e.type === 'touchend' && e.changedTouches?.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const container = mapRef.current.getContainer();
    const rect = container.getBoundingClientRect();
    const point = L.point(clientX - rect.left, clientY - rect.top);
    const latlng = mapRef.current.containerPointToLatLng(point);

    const newPoints = [...drawPointsRef.current, [latlng.lat, latlng.lng]];
    drawPointsRef.current = newPoints;
    setDrawPoints([...newPoints]);

    if (newPoints.length >= 4) {
      setShowCreateDialog(true);
      // Scroll to top so dialog is visible on iPad
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleCreateBay = async () => {
    if (!form.name.trim()) return toast.error('Enter a bay name');
    if (!form.bay_color) return toast.error('Select a colour for this bay');
    try {
      await createYardLocation({ ...form, polygon: drawPointsRef.current, colorIndex: locations.length });
      toast.success(`Bay "${form.name}" created`);
      setShowCreateDialog(false);
      setIsDrawing(false);
      drawPointsRef.current = [];
      setDrawPoints([]);
      setForm({ name: '', section: 'A', capacity: 20, description: '', bay_color: '' });
      fetchData();
    } catch { toast.error('Failed to create bay'); }
  };

  const handleDelete = async (id) => {
    try { await deleteYardLocation(id); toast.success('Bay removed'); fetchData(); } catch { toast.error('Failed'); }
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    drawPointsRef.current = [];
    setDrawPoints([]);
  };

  const totalStock = colours.reduce((s, c) => s + (c.quantity || 0), 0);

  return (
    <div className="space-y-6" data-testid="yard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Yard Map</h1>
          <p className="text-sm text-[#4A5D53] mt-1">///imparts.thud.crest — Mains of Corsindae</p>
        </div>
        {!isDrawing ? (
          <Button onClick={() => { setIsDrawing(true); drawPointsRef.current = []; setDrawPoints([]); }} className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="draw-bay-button">
            <Plus className="w-4 h-4 mr-2" /> Draw Bay
          </Button>
        ) : (
          <Button onClick={cancelDrawing} className="bg-red-600 text-white hover:bg-red-700 rounded-lg">
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1"><span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">In Stock</span><Package className="w-4 h-4 text-[#1A4331]" /></div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalStock}</p>
          <p className="text-xs text-[#4A5D53]">{(totalStock * 100).toLocaleString()} trees</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1"><span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">From Field</span><TreePine className="w-4 h-4 text-emerald-600" /></div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{collected?.total_received_pallets || 0}</p>
          <p className="text-xs text-[#4A5D53]">{(collected?.total_received_trees || 0).toLocaleString()} trees</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1"><span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Collected</span><TruckIcon className="w-4 h-4 text-[#E27B58]" /></div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{collected?.total_collected_pallets || 0}</p>
          <p className="text-xs text-[#4A5D53]">{(collected?.total_collected_trees || 0).toLocaleString()} trees</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1"><span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Bays</span><MapPin className="w-4 h-4 text-[#1A4331]" /></div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{locations.length}</p>
        </div>
      </div>

      {isDrawing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800 font-medium">Tap 4 corners on the map — Corner {Math.min(drawPoints.length + 1, 4)} of 4</p>
        </div>
      )}

      {/* Static Map */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden relative" style={{ height: '500px' }} data-testid="yard-map">
        <MapContainer center={YARD_CENTER} zoom={18} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false} ref={mapRef}>
          <LockMap />
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={20} />
          <PinMarkers points={drawPoints} />
          <DrawPreview points={drawPoints} />
          {locations.map((loc) => (
            <React.Fragment key={loc.id}>
              <BayPolygon bay={loc} />
              <BayLabel bay={loc} />
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Tap overlay for drawing — sits on top of the static map */}
        {isDrawing && drawPoints.length < 4 && (
          <div
            onClick={handleOverlayTap}
            onTouchEnd={handleOverlayTap}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, cursor: 'crosshair', touchAction: 'none' }}
          >
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#1A4331]/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10">
              Tap corner {drawPoints.length + 1} of 4
            </div>
          </div>
        )}
      </div>

      {/* Stock by Colour */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stock-overview">
        {colours.map((c) => (
          <div key={c.id} className="bg-white border border-[#1A4331]/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_HEX[c.color] || '#1A4331' }} />
              <span className="text-sm font-semibold capitalize text-[#0A1711]">{c.label || c.color}</span>
            </div>
            <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{c.quantity || 0}</p>
            <p className="text-xs text-[#4A5D53]">{(c.quantity || 0) * 100} trees</p>
          </div>
        ))}
      </div>

      {/* Bay List */}
      {locations.length > 0 && (
        <div className="bg-white border border-[#1A4331]/15 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-[#0A1711] font-['Outfit'] mb-4">Bays ({locations.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map((loc) => (
              <div key={loc.id} className="bg-[#F4F1ED] rounded-xl p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: COLOR_HEX[loc.bay_color] || '#1A4331' }} />
                  <div>
                    <h4 className="font-semibold text-sm text-[#0A1711]">{loc.name}</h4>
                    <p className="text-xs text-[#4A5D53]">{loc.bay_color ? `${loc.bay_color} bay` : `Section ${loc.section}`} &middot; Capacity: {loc.capacity}</p>
                    <p className="text-xs font-bold text-[#0A1711] mt-1">{loc.current_stock || 0} pallets</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)} className="text-red-400 hover:text-red-600" data-testid={`delete-bay-${loc.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Bay Dialog — includes colour picker */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setIsDrawing(false); drawPointsRef.current = []; setDrawPoints([]); } }}>
        <DialogContent data-testid="create-bay-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Name This Bay</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Bay Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bay A1, North Row" data-testid="bay-name-input" />
            </div>
            <div>
              <Label>Colour (what colour trees in this bay?)</Label>
              <Select value={form.bay_color} onValueChange={v => setForm({ ...form, bay_color: v })}>
                <SelectTrigger data-testid="bay-color-select"><SelectValue placeholder="Select colour" /></SelectTrigger>
                <SelectContent>
                  {colours.map(c => (
                    <SelectItem key={c.color} value={c.color}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_HEX[c.color] || '#1A4331' }} />
                        <span className="capitalize">{c.label || c.color}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
