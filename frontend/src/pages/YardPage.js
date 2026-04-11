import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getYardLocations, createYardLocation, deleteYardLocation, getColours, getTotalCollected } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Plus, Trash2, MapPin, Package, X, RotateCw, TreePine, TruckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Polygon, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const YARD_CENTER = [57.150, -2.500];
const COLOR_MAP = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04' };
const BAY_COLORS = ['#16a34a', '#2563eb', '#dc2626', '#ca8a04', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

// Rotate a point around a center by angle (degrees)
function rotatePoint(center, point, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [
    center[0] + dx * cos - dy * sin,
    center[1] + dx * sin + dy * cos,
  ];
}

// Create a rotated rectangle from center, width, height, angle
function makeRotatedRect(center, width, height, angleDeg) {
  const hw = width / 2;
  const hh = height / 2;
  const corners = [
    [center[0] - hh, center[1] - hw],
    [center[0] - hh, center[1] + hw],
    [center[0] + hh, center[1] + hw],
    [center[0] + hh, center[1] - hw],
  ];
  return corners.map(c => rotatePoint(center, c, angleDeg));
}

function DrawPolygonTool({ isDrawing, onPolygonDrawn, onCancel }) {
  const [points, setPoints] = useState([]);
  const map = useMap();
  const pointsRef = useRef([]);

  // Keep ref in sync
  useEffect(() => { pointsRef.current = points; }, [points]);

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();

    if (isDrawing) {
      // Disable ALL map interactions
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      if (map.tap) map.tap.disable();
      container.style.cursor = 'crosshair';

      // Direct touch/click handler on the map container
      const handleTap = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Get coordinates from touch or mouse
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
          clientX = e.clientX;
          clientY = e.clientY;
        }

        // Convert screen coords to map latlng
        const rect = container.getBoundingClientRect();
        const point = L.point(clientX - rect.left, clientY - rect.top);
        const latlng = map.containerPointToLatLng(point);

        const current = [...pointsRef.current, [latlng.lat, latlng.lng]];
        pointsRef.current = current;
        setPoints([...current]);

        if (current.length >= 4) {
          onPolygonDrawn(current);
          pointsRef.current = [];
          setPoints([]);
        }
      };

      // Use touchend for iPad/iPhone, click for desktop
      container.addEventListener('touchend', handleTap, { passive: false });
      container.addEventListener('click', handleTap);

      return () => {
        container.removeEventListener('touchend', handleTap);
        container.removeEventListener('click', handleTap);
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        if (map.tap) map.tap.enable();
        container.style.cursor = '';
      };
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      if (map.tap) map.tap.enable();
      container.style.cursor = '';
      pointsRef.current = [];
      setPoints([]);
    }
  }, [isDrawing, map, onPolygonDrawn]);

  if (!isDrawing || points.length === 0) return null;

  if (points.length >= 2) {
    return <Polygon positions={points} pathOptions={{ color: '#1A4331', weight: 2, fillOpacity: 0.2, dashArray: '6,4' }} />;
  }
  // Show markers for single point
  if (points.length === 1) {
    const icon = L.divIcon({
      className: 'draw-point',
      html: '<div style="width:12px;height:12px;background:#1A4331;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    return <Marker position={points[0]} icon={icon} />;
  }
  return null;
}

function BayPolygon({ bay, onDelete, idx }) {
  const bayColor = BAY_COLORS[idx % BAY_COLORS.length];
  const positions = bay.polygon || bay.bounds;
  if (!positions || positions.length < 3) return null;

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: bayColor,
        weight: 3,
        fillColor: bayColor,
        fillOpacity: (bay.current_stock || 0) > 0 ? 0.35 : 0.15,
      }}
    >
    </Polygon>
  );
}

function BayLabel({ bay, idx }) {
  const positions = bay.polygon || bay.bounds;
  if (!positions || positions.length < 3) return null;

  // Calculate centroid
  const center = positions.reduce(
    (acc, p) => [acc[0] + p[0] / positions.length, acc[1] + p[1] / positions.length],
    [0, 0]
  );

  const bayColor = BAY_COLORS[idx % BAY_COLORS.length];
  const stock = bay.current_stock || 0;

  const icon = L.divIcon({
    className: 'bay-label-icon',
    html: `<div style="
      background: rgba(255,255,255,0.95);
      border: 2px solid ${bayColor};
      border-radius: 8px;
      padding: 4px 10px;
      text-align: center;
      font-family: Outfit, sans-serif;
      min-width: 70px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: none;
    ">
      <div style="font-size: 10px; font-weight: 700; color: ${bayColor}; text-transform: uppercase; letter-spacing: 0.5px;">${bay.name}</div>
      <div style="font-size: 20px; font-weight: 800; color: #0A1711; line-height: 1.1;">${stock}</div>
      <div style="font-size: 9px; color: #4A5D53;">pallets</div>
    </div>`,
    iconSize: [80, 60],
    iconAnchor: [40, 30],
  });

  return <Marker position={center} icon={icon} interactive={false} />;
}

export default function YardPage() {
  const [locations, setLocations] = useState([]);
  const [colours, setColours] = useState([]);
  const [collected, setCollected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pendingPolygon, setPendingPolygon] = useState(null);
  const [form, setForm] = useState({ name: '', section: 'A', capacity: 20, description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locRes, colRes, collRes] = await Promise.all([
        getYardLocations(), getColours(), getTotalCollected()
      ]);
      setLocations(locRes.data);
      setColours(colRes.data);
      setCollected(collRes.data);
    } catch (err) {
      toast.error('Failed to fetch yard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handlePolygonDrawn = (points) => {
    setPendingPolygon(points);
    setIsDrawing(false);
    setShowCreateDialog(true);
  };

  const handleCreateBay = async () => {
    if (!form.name.trim()) return toast.error('Enter a bay name');
    try {
      await createYardLocation({
        ...form,
        polygon: pendingPolygon,
        colorIndex: locations.length
      });
      toast.success(`Bay "${form.name}" created`);
      setShowCreateDialog(false);
      setPendingPolygon(null);
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
          <p className="text-sm text-[#4A5D53] mt-1">Mains of Corsindae — click 4 corners to draw a bay</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => { setIsDrawing(!isDrawing); }}
            className={`rounded-lg ${isDrawing ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1A4331] hover:bg-[#1A4331]/90'} text-white`}
            data-testid="draw-bay-button"
          >
            {isDrawing ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> Draw Bay</>}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">In Stock</span>
            <Package className="w-4 h-4 text-[#1A4331]" />
          </div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{totalStock}</p>
          <p className="text-xs text-[#4A5D53]">{(totalStock * 100).toLocaleString()} trees</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Received from Field</span>
            <TreePine className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{collected?.total_received_pallets || 0}</p>
          <p className="text-xs text-[#4A5D53]">{(collected?.total_received_trees || 0).toLocaleString()} trees total</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Collected from Site</span>
            <TruckIcon className="w-4 h-4 text-[#E27B58]" />
          </div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{collected?.total_collected_pallets || 0}</p>
          <p className="text-xs text-[#4A5D53]">{(collected?.total_collected_trees || 0).toLocaleString()} trees dispatched</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#4A5D53]">Bays</span>
            <MapPin className="w-4 h-4 text-[#1A4331]" />
          </div>
          <p className="text-2xl font-bold text-[#0A1711] font-['Outfit']">{locations.length}</p>
          <p className="text-xs text-[#4A5D53]">configured on map</p>
        </div>
      </div>

      {isDrawing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Drawing mode active:</strong> Tap 4 corners on the map to outline your bay. The shape will close automatically after the 4th tap. Map scrolling is disabled while drawing.
        </div>
      )}

      {/* Map */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" style={{ height: '500px' }} data-testid="yard-map">
        <MapContainer
          center={YARD_CENTER}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          tap={false}
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
          <DrawPolygonTool
            isDrawing={isDrawing}
            onPolygonDrawn={handlePolygonDrawn}
            onCancel={() => setIsDrawing(false)}
          />
          {locations.map((loc, idx) => (
            <React.Fragment key={loc.id}>
              <BayPolygon bay={loc} onDelete={handleDelete} idx={idx} />
              <BayLabel bay={loc} idx={idx} />
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {/* Stock by Colour */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stock-overview">
        {colours.map((c) => (
          <div key={c.id} className="bg-white border border-[#1A4331]/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_MAP[c.color] || '#1A4331' }} />
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
            {locations.map((loc, idx) => {
              const bayColor = BAY_COLORS[idx % BAY_COLORS.length];
              return (
                <div key={loc.id} className="bg-[#F4F1ED] rounded-xl p-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: bayColor }} />
                    <div>
                      <h4 className="font-semibold text-sm text-[#0A1711]">{loc.name}</h4>
                      <p className="text-xs text-[#4A5D53]">Section {loc.section} &middot; Capacity: {loc.capacity}</p>
                      <p className="text-xs font-bold text-[#0A1711] mt-1">{loc.current_stock || 0} pallets</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)} className="text-red-400 hover:text-red-600" data-testid={`delete-bay-${loc.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Bay Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setPendingPolygon(null); } }}>
        <DialogContent data-testid="create-bay-dialog">
          <DialogHeader><DialogTitle className="font-['Outfit']">Name This Bay</DialogTitle></DialogHeader>
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
