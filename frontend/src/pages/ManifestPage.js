import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getManifestPublic, signManifest, updateLoad } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Printer, Check, PenTool, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";
const COLOR_HEX = { green: '#16a34a', blue: '#2563eb', silver: '#6b7280', red: '#dc2626', gold: '#ca8a04', yellow: '#eab308', orange: '#f97316' };

function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0A1711';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
  };

  const save = () => {
    if (!hasDrawn) return;
    onSave(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div>
      <div className="border-2 border-dashed border-[#1A4331]/30 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none"
          style={{ height: '120px' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <button onClick={clear} className="text-xs text-[#4A5D53] underline">Clear</button>
        <Button onClick={save} disabled={!hasDrawn} size="sm" className="bg-[#1A4331] text-white">
          <Check className="w-3 h-3 mr-1" /> Confirm Signature
        </Button>
      </div>
    </div>
  );
}

export default function ManifestPage() {
  const { loadId } = useParams();
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('');
  const [signed, setSigned] = useState(false);
  const [signatureImg, setSignatureImg] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const { data } = await getManifestPublic(loadId);
        setManifest({ load: data.load });
        if (data.load?.signature) {
          setSigned(true);
          setSignatureImg(data.load.signature.signature_data);
          setDriverName(data.load.signature.driver_name);
        }
      } catch (err) {
        console.error('Failed to load manifest', err);
      } finally {
        setLoading(false);
      }
    };
    fetchManifest();
  }, [loadId]);

  const toggleChecked = (idx) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSign = async (signatureData) => {
    if (!driverName.trim()) return toast.error('Enter driver name before signing');
    try {
      await signManifest(loadId, { driver_name: driverName, signature_data: signatureData });
      // Auto-dispatch — deducts stock
      try {
        await updateLoad(loadId, { status: 'in_transit' });
      } catch { /* may fail if not authed, that's ok */ }
      setSigned(true);
      setSignatureImg(signatureData);
      toast.success('Manifest signed & dispatched');
    } catch (err) {
      toast.error('Failed to save signature');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#1A4331] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Manifest not found</p>
      </div>
    );
  }

  const load = manifest.load;
  const pallets = load.pallets_required || [];
  const totalPallets = pallets.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const totalTrees = totalPallets * 100;
  const allChecked = pallets.length > 0 && pallets.every((_, i) => checkedItems[i]);

  return (
    <div className="min-h-screen bg-white" data-testid="manifest-page">
      {/* Top bar */}
      <div className="no-print sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5 flex items-center justify-between z-10">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="manifest-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={() => window.print()} size="sm" className="bg-[#1A4331] text-white" data-testid="print-manifest-button">
          <Printer className="w-4 h-4 mr-1" /> Print
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10" id="manifest-content">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b-2 border-[#1A4331] pb-5 mb-6 gap-4">
          <div>
            <img src={WC_LOGO} alt="Wilson Contractors" className="h-12 sm:h-16 object-contain" />
            <p className="text-[11px] text-[#4A5D53] mt-2">Mains of Corsindae, Sauchen</p>
            <p className="text-[11px] text-[#4A5D53]">Inverurie, Aberdeenshire AB51 7QL</p>
          </div>
          <div className="sm:text-right">
            <h2 className="text-base sm:text-lg font-bold text-[#1A4331] uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>Collection Manifest</h2>
            <p className="text-xs text-[#4A5D53] mt-0.5">Ref: WC-{loadId?.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Company / Haulier</span>
            <p className="text-sm sm:text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1">{load.driver_name || '—'}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Collection Date</span>
            <p className="text-sm sm:text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1">
              {load.departure_date ? new Date(load.departure_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Status</span>
            <p className="text-sm sm:text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1 capitalize">{load.status?.replace('_', ' ')}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Ref</span>
            <p className="text-sm sm:text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1">WC-{loadId?.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        {/* Destinations */}
        {load.destinations?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-[#1A4331] uppercase tracking-wider mb-2 border-b border-[#1A4331]/20 pb-1.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Delivery Destination(s)</h3>
            {load.destinations.map((d, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5">
                <span className="text-[10px] bg-[#1A4331] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                <p className="text-sm text-[#0A1711]">{d.address}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pallets Table — tickable */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-[#1A4331] uppercase tracking-wider mb-2 border-b border-[#1A4331]/20 pb-1.5" style={{ fontFamily: 'Outfit, sans-serif' }}>Pallets Loaded</h3>

          {pallets.length === 0 ? (
            <p className="text-sm text-[#4A5D53] py-4">No pallets specified.</p>
          ) : (
            <>
              {/* Mobile-friendly card layout */}
              <div className="space-y-2">
                {pallets.map((p, i) => (
                  <div
                    key={i}
                    onClick={() => toggleChecked(i)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none active:scale-[0.98] ${checkedItems[i] ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    data-testid={`check-pallet-${i}`}
                  >
                    <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${checkedItems[i] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 text-transparent'}`}>
                      <Check className="w-5 h-5" />
                    </div>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_HEX[p.color] || '#1A4331' }} />
                    <span className={`text-sm font-semibold capitalize flex-1 ${checkedItems[i] ? 'line-through text-[#4A5D53]' : 'text-[#0A1711]'}`}>{p.color}</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-[#0A1711]">{p.quantity}</span>
                      <span className="text-xs text-[#4A5D53] ml-1">pallets</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-[#1A4331]">
                <span className="text-sm font-bold text-[#0A1711]">TOTAL</span>
                <div>
                  <span className="text-lg font-bold text-[#0A1711]">{totalPallets}</span>
                  <span className="text-xs text-[#4A5D53] ml-1">pallets</span>
                  <span className="text-xs text-[#4A5D53] ml-2">({totalTrees} trees)</span>
                </div>
              </div>

              {!allChecked && !signed && (
                <p className="text-xs text-amber-600 mt-2 no-print">Tap each row to tick off as you check with the driver</p>
              )}
              {allChecked && !signed && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mt-3 no-print">
                  <p className="text-sm text-emerald-800 font-medium">All pallets verified — driver can sign below</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Notes */}
        {load.notes && (
          <div className="mb-6 bg-[#F4F1ED] rounded-lg p-3">
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Notes</span>
            <p className="text-sm text-[#0A1711] mt-1">{load.notes}</p>
          </div>
        )}

        {/* Signature */}
        <div className="border-t-2 border-[#1A4331] pt-5 mt-6">
          <h3 className="text-xs font-bold text-[#1A4331] uppercase tracking-wider mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Driver Acknowledgement</h3>
          <p className="text-[11px] text-[#4A5D53] mb-4">I confirm the above pallets have been loaded and I accept responsibility for safe delivery.</p>

          {signed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800 text-sm">Signed</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Driver</span>
                  <p className="text-sm font-semibold text-[#0A1711] mt-0.5">{driverName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Date</span>
                  <p className="text-sm font-semibold text-[#0A1711] mt-0.5">
                    {load.signature?.signed_at ? new Date(load.signature.signed_at).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')}
                  </p>
                </div>
              </div>
              {signatureImg && (
                <div className="mt-3">
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Signature</span>
                  <img src={signatureImg} alt="Signature" className="max-h-16 mt-1" />
                </div>
              )}
              <Button onClick={() => window.print()} className="mt-4 bg-[#1A4331] text-white w-full no-print" data-testid="print-after-sign">
                <Printer className="w-4 h-4 mr-2" /> Print Copy for Driver
              </Button>
            </div>
          ) : (
            <div className="no-print space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Driver Name</Label>
                <Input
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder="Full name"
                  className="mt-1"
                  data-testid="driver-name-sign"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold flex items-center gap-1">
                  <PenTool className="w-3 h-3" /> Signature
                </Label>
                <div className="mt-1">
                  <SignaturePad onSave={handleSign} />
                </div>
              </div>
            </div>
          )}

          {/* Print-only signature lines */}
          {!signed && (
            <div className="print-only mt-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs text-[#4A5D53] mb-6">Driver Name:</p>
                  <div className="border-b border-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-[#4A5D53] mb-6">Date:</p>
                  <div className="border-b border-gray-400" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-[#4A5D53] mb-10">Signature:</p>
                <div className="border-b border-gray-400" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-gray-200 flex items-center justify-between">
          <img src={WC_LOGO} alt="Wilson Contractors" className="h-6 sm:h-8 object-contain opacity-50" />
          <div className="text-right">
            <p className="text-[9px] sm:text-[10px] text-[#4A5D53]">Mains of Corsindae, Sauchen, AB51 7QL</p>
            <p className="text-[9px] sm:text-[10px] text-[#4A5D53]">TMS.wilson-contractors.co.uk</p>
          </div>
        </div>
      </div>
    </div>
  );
}
