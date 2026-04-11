import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getManifestPublic, signManifest } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Printer, Check, PenTool } from 'lucide-react';
import { toast } from 'sonner';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";

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
    const data = canvasRef.current.toDataURL('image/png');
    onSave(data);
  };

  return (
    <div>
      <div className="border-2 border-dashed border-[#1A4331]/30 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none"
          style={{ height: '150px' }}
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
        <button onClick={clear} className="text-xs text-[#4A5D53] underline">Clear signature</button>
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

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, [loadId]);

  const handleSign = async (signatureData) => {
    if (!driverName.trim()) return toast.error('Enter driver name before signing');
    try {
      await signManifest(loadId, {
        driver_name: driverName,
        signature_data: signatureData
      });
      setSigned(true);
      setSignatureImg(signatureData);
      toast.success('Manifest signed successfully');
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
  const totalPallets = (load.pallets_required || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
  const totalTrees = totalPallets * 100;

  return (
    <div className="min-h-screen bg-white" data-testid="manifest-page">
      {/* Print button - hidden on print */}
      <div className="no-print sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10">
        <span className="text-sm text-gray-500">Collection Manifest — {load.driver_name}</span>
        <div className="flex items-center gap-3">
          <Button onClick={() => window.print()} className="bg-[#1A4331] text-white" data-testid="print-manifest-button">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* Manifest Content */}
      <div className="max-w-3xl mx-auto px-8 py-10" id="manifest-content">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-[#1A4331] pb-6 mb-8">
          <div className="flex items-center gap-4">
            <img src={WC_LOGO} alt="Wilson Contractors" className="h-14 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-[#0A1711]" style={{ fontFamily: 'Outfit, sans-serif' }}>Wilson Contractors</h1>
              <p className="text-sm text-[#4A5D53]">Mains of Corsindae, Sauchen, Aberdeenshire</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-[#1A4331] uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>Collection Manifest</h2>
            <p className="text-xs text-[#4A5D53] mt-1">Ref: WC-{loadId?.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        {/* Collection Details */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Company / Haulier</span>
            <p className="text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1">
              {load.driver_name || '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Collection Date</span>
            <p className="text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1">
              {load.departure_date ? new Date(load.departure_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Status</span>
            <p className="text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1 capitalize">
              {load.status?.replace('_', ' ')}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Manifest Ref</span>
            <p className="text-base font-semibold text-[#0A1711] mt-0.5 border-b border-dotted border-gray-300 pb-1">
              WC-{loadId?.slice(-6).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Destinations */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-[#1A4331] uppercase tracking-wider mb-3 border-b border-[#1A4331]/20 pb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Delivery Destination(s)
          </h3>
          {load.destinations?.map((d, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <span className="text-xs bg-[#1A4331] text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
              <p className="text-sm text-[#0A1711]">{d.address}</p>
            </div>
          ))}
        </div>

        {/* Pallets Table */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-[#1A4331] uppercase tracking-wider mb-3 border-b border-[#1A4331]/20 pb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Pallets Loaded
          </h3>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#1A4331]">
                <th className="text-left text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold py-2 pr-4">Colour</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold py-2 px-4">Pallets</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold py-2 px-4">Trees</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold py-2 pl-4">Checked</th>
              </tr>
            </thead>
            <tbody>
              {(load.pallets_required || []).map((p, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color === 'green' ? '#16a34a' : p.color === 'blue' ? '#2563eb' : p.color === 'silver' ? '#6b7280' : '#1A4331' }} />
                      <span className="text-sm font-medium capitalize">{p.color}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-sm font-bold">{p.quantity}</td>
                  <td className="text-right py-3 px-4 text-sm text-[#4A5D53]">{(p.quantity || 0) * 100}</td>
                  <td className="text-right py-3 pl-4">
                    <div className="w-5 h-5 border-2 border-gray-300 rounded inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#1A4331]">
                <td className="py-3 pr-4 text-sm font-bold text-[#0A1711]">TOTAL</td>
                <td className="text-right py-3 px-4 text-sm font-bold text-[#0A1711]">{totalPallets}</td>
                <td className="text-right py-3 px-4 text-sm font-bold text-[#0A1711]">{totalTrees}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {load.notes && (
          <div className="mb-8 bg-[#F4F1ED] rounded-lg p-4">
            <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Notes</span>
            <p className="text-sm text-[#0A1711] mt-1">{load.notes}</p>
          </div>
        )}

        {/* Signature Section */}
        <div className="border-t-2 border-[#1A4331] pt-6 mt-8">
          <h3 className="text-sm font-bold text-[#1A4331] uppercase tracking-wider mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Driver Acknowledgement
          </h3>
          <p className="text-xs text-[#4A5D53] mb-4">
            I confirm that the above pallets have been loaded onto the vehicle and I accept responsibility for their safe delivery.
          </p>

          {signed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800">Signed</span>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Driver Name</span>
                  <p className="text-sm font-semibold text-[#0A1711] mt-1 border-b border-dotted border-gray-300 pb-1">{driverName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Date & Time</span>
                  <p className="text-sm font-semibold text-[#0A1711] mt-1 border-b border-dotted border-gray-300 pb-1">
                    {load.signature?.signed_at ? new Date(load.signature.signed_at).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')}
                  </p>
                </div>
              </div>
              {signatureImg && (
                <div className="mt-4">
                  <span className="text-[10px] uppercase tracking-wider text-[#4A5D53] font-bold">Signature</span>
                  <img src={signatureImg} alt="Driver Signature" className="max-h-24 mt-1" />
                </div>
              )}
            </div>
          ) : (
            <div className="no-print space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#4A5D53] font-bold">Driver Name (print)</Label>
                <Input
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1 max-w-sm"
                  data-testid="driver-name-sign"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#4A5D53] font-bold flex items-center gap-1">
                  <PenTool className="w-3 h-3" /> Signature (draw below)
                </Label>
                <div className="mt-1 max-w-lg">
                  <SignaturePad onSave={handleSign} />
                </div>
              </div>
            </div>
          )}

          {/* Print-only signature lines */}
          {!signed && (
            <div className="print-only mt-8">
              <div className="grid grid-cols-2 gap-12">
                <div>
                  <p className="text-xs text-[#4A5D53] mb-8">Driver Name (print):</p>
                  <div className="border-b border-gray-400 mb-2" />
                </div>
                <div>
                  <p className="text-xs text-[#4A5D53] mb-8">Date:</p>
                  <div className="border-b border-gray-400 mb-2" />
                </div>
              </div>
              <div className="mt-6">
                <p className="text-xs text-[#4A5D53] mb-12">Signature:</p>
                <div className="border-b border-gray-400" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-200 text-center">
          <p className="text-[10px] text-[#4A5D53]">Wilson Contractors Ltd — Mains of Corsindae, Sauchen, Inverurie, Aberdeenshire AB51 7QL</p>
          <p className="text-[10px] text-[#4A5D53]">TMS.wilson-contractors.co.uk</p>
        </div>
      </div>
    </div>
  );
}
