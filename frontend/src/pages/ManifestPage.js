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
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * (c.width / r.width), y: (cy - r.top) * (c.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); setIsDrawing(true); setHasDrawn(true); };
  const draw = (e) => { if (!isDrawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = getPos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0A1711'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const end = () => setIsDrawing(false);
  const clear = () => { canvasRef.current.getContext('2d').clearRect(0, 0, 500, 120); setHasDrawn(false); };
  return (
    <div>
      <div className="border border-dashed border-gray-300 rounded bg-white overflow-hidden">
        <canvas ref={canvasRef} width={500} height={120} className="w-full touch-none" style={{ height: '60px' }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <button onClick={clear} className="text-[10px] text-gray-400 underline">Clear</button>
        <Button onClick={() => hasDrawn && onSave(canvasRef.current.toDataURL('image/png'))} disabled={!hasDrawn} size="sm" className="bg-[#1A4331] text-white text-xs h-7">
          <Check className="w-3 h-3 mr-1" /> Sign & Dispatch
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
  const [registration, setRegistration] = useState('');
  const [signed, setSigned] = useState(false);
  const [signatureImg, setSignatureImg] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getManifestPublic(loadId);
        setManifest({ load: data.load });
        if (data.load?.signature) {
          setSigned(true);
          setSignatureImg(data.load.signature.signature_data);
          setDriverName(data.load.signature.driver_name);
          setRegistration(data.load.signature.registration || '');
        }
      } catch { }
      setLoading(false);
    })();
  }, [loadId]);

  const toggleChecked = (i) => setCheckedItems(prev => ({ ...prev, [i]: !prev[i] }));

  const handleSign = async (sigData) => {
    if (!driverName.trim()) return toast.error('Enter driver name');
    try {
      await signManifest(loadId, { driver_name: driverName, signature_data: sigData, registration });
      try { await updateLoad(loadId, { status: 'in_transit' }); } catch {}
      setSigned(true);
      setSignatureImg(sigData);
      toast.success('Signed & dispatched');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-6 h-6 border-2 border-[#1A4331] border-t-transparent rounded-full animate-spin" /></div>;
  if (!manifest) return <div className="min-h-screen flex items-center justify-center bg-white"><p className="text-gray-500">Manifest not found</p></div>;

  const load = manifest.load;
  const pallets = load.pallets_required || [];
  const totalPallets = pallets.reduce((s, p) => s + (p.quantity || 0), 0);
  const allChecked = pallets.length > 0 && pallets.every((_, i) => checkedItems[i]);

  return (
    <div className="min-h-screen bg-white" data-testid="manifest-page">
      {/* Top bar */}
      <div className="no-print sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between z-10">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <Button onClick={() => window.print()} size="sm" className="bg-[#1A4331] text-white"><Printer className="w-4 h-4 mr-1" /> Print</Button>
      </div>

      {/* Single page manifest */}
      <div className="max-w-[210mm] mx-auto px-6 py-4 print:p-6 print:max-w-none" style={{ maxHeight: '297mm' }}>
        {/* Row 1: Header */}
        <div className="flex items-start justify-between border-b-2 border-[#1A4331] pb-3 mb-3">
          <div>
            <img src={WC_LOGO} alt="Wilson Contractors" className="h-10 object-contain" />
            <p className="text-[9px] text-[#4A5D53] mt-1">Mains of Corsindae, Sauchen, AB51 7QL</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-[#1A4331] uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>Collection Manifest</h2>
            <p className="text-[9px] text-[#4A5D53]">Ref: WC-{loadId?.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        {/* Row 2: Details grid - compact */}
        <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Hauler</span>
            <p className="font-semibold text-[#0A1711] leading-tight">{load.driver_name || '—'}</p>
            {(load.signature?.registration || registration) && <p className="text-[#4A5D53]">Reg: {load.signature?.registration || registration}</p>}
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Date</span>
            <p className="font-semibold text-[#0A1711] leading-tight">
              {load.departure_date ? new Date(load.departure_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </p>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Destination</span>
            <p className="font-semibold text-[#0A1711] leading-tight">{load.destinations?.map(d => d.address).join('; ') || '—'}</p>
          </div>
          <div>
            <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Status</span>
            <p className="font-semibold text-[#0A1711] capitalize leading-tight">{load.status?.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Row 3: Pallets table - compact */}
        <table className="w-full mb-3 text-xs">
          <thead>
            <tr className="border-b-2 border-[#1A4331]">
              <th className="text-left text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold py-1">Colour</th>
              <th className="text-right text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold py-1">Pallets</th>
              <th className="text-right text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold py-1">Trees</th>
              <th className="text-center text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold py-1 w-16">Checked</th>
            </tr>
          </thead>
          <tbody>
            {pallets.map((p, i) => (
              <tr key={i} onClick={() => !signed && toggleChecked(i)} className={`border-b border-gray-100 cursor-pointer select-none ${checkedItems[i] ? 'bg-emerald-50' : ''}`}>
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[p.color] || '#1A4331' }} />
                    <span className={`font-medium capitalize ${checkedItems[i] ? 'line-through text-gray-400' : ''}`}>{p.color}</span>
                  </div>
                </td>
                <td className="text-right font-bold py-1.5">{p.quantity}</td>
                <td className="text-right text-[#4A5D53] py-1.5">{(p.quantity || 0) * 100}</td>
                <td className="text-center py-1.5">
                  <div className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center mx-auto transition-all ${checkedItems[i] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 text-transparent print:border-gray-400'}`}>
                    <Check className="w-3 h-3" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1A4331]">
              <td className="py-1.5 font-bold">TOTAL</td>
              <td className="text-right font-bold py-1.5">{totalPallets}</td>
              <td className="text-right font-bold py-1.5">{totalPallets * 100}</td>
              <td className="text-center py-1.5">{allChecked && <Check className="w-4 h-4 text-emerald-600 mx-auto" />}</td>
            </tr>
          </tfoot>
        </table>

        {/* Row 4: Notes (if any) */}
        {load.notes && (
          <div className="mb-3 bg-[#F4F1ED] rounded px-3 py-1.5 text-xs">
            <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold">Notes: </span>
            <span className="text-[#0A1711]">{load.notes}</span>
          </div>
        )}

        {/* Row 5: Signature section */}
        <div className="border-t-2 border-[#1A4331] pt-3">
          <p className="text-[9px] text-[#4A5D53] mb-2">I confirm the above pallets have been loaded and I accept responsibility for safe delivery to the stated destination(s).</p>

          {signed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Driver</span>
                  <p className="font-semibold">{driverName}</p>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Registration</span>
                  <p className="font-semibold">{registration || '—'}</p>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold block">Date/Time</span>
                  <p className="font-semibold">{load.signature?.signed_at ? new Date(load.signature.signed_at).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')}</p>
                </div>
              </div>
              {signatureImg && (
                <div className="mt-2">
                  <span className="text-[8px] uppercase tracking-wider text-[#4A5D53] font-bold">Signature</span>
                  <img src={signatureImg} alt="Signature" className="max-h-12 mt-0.5" />
                </div>
              )}
              <Button onClick={() => window.print()} size="sm" className="mt-2 bg-[#1A4331] text-white no-print w-full text-xs">
                <Printer className="w-3 h-3 mr-1" /> Print Copy for Driver
              </Button>
            </div>
          ) : (
            <>
              {/* Screen: interactive signing */}
              <div className="no-print space-y-2">
                {!allChecked && pallets.length > 0 && <p className="text-[10px] text-amber-600">Tap each pallet row above to check off</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[9px] text-[#4A5D53] font-bold uppercase tracking-wider">Driver Name</Label>
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Full name" className="h-8 text-sm mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-[9px] text-[#4A5D53] font-bold uppercase tracking-wider">Registration</Label>
                    <Input value={registration} onChange={e => setRegistration(e.target.value)} placeholder="e.g. AB12 CDE" className="h-8 text-sm mt-0.5" />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px] text-[#4A5D53] font-bold uppercase tracking-wider flex items-center gap-1"><PenTool className="w-3 h-3" /> Signature</Label>
                  <div className="mt-0.5"><SignaturePad onSave={handleSign} /></div>
                </div>
              </div>
              {/* Print: blank signature lines */}
              <div className="print-only">
                <div className="grid grid-cols-3 gap-6 mt-2">
                  <div><p className="text-[9px] text-[#4A5D53] mb-4">Driver Name:</p><div className="border-b border-gray-400" /></div>
                  <div><p className="text-[9px] text-[#4A5D53] mb-4">Registration:</p><div className="border-b border-gray-400" /></div>
                  <div><p className="text-[9px] text-[#4A5D53] mb-4">Date:</p><div className="border-b border-gray-400" /></div>
                </div>
                <div className="mt-3"><p className="text-[9px] text-[#4A5D53] mb-6">Signature:</p><div className="border-b border-gray-400" /></div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between">
          <img src={WC_LOGO} alt="WC" className="h-5 object-contain opacity-40" />
          <p className="text-[8px] text-[#4A5D53]">TMS.wilson-contractors.co.uk</p>
        </div>
      </div>
    </div>
  );
}
