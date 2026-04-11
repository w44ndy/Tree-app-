import React, { useState, useEffect } from 'react';
import { getOrders, createOrder, updateOrder, deleteOrder, checkOrderFulfillment } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, CheckCircle, XCircle, ClipboardList, Search } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['green', 'blue', 'silver'];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showFulfillment, setShowFulfillment] = useState(null);
  const [fulfillmentData, setFulfillmentData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    customer_name: '', delivery_address: '', contact_phone: '',
    items: [{ tree_color: 'green', quantity: 10 }],
    delivery_date: '', notes: ''
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const { data } = await getOrders(params);
      setOrders(data);
    } catch (err) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [filterStatus]);

  const addItem = () => setForm({...form, items: [...form.items, { tree_color: 'green', quantity: 10 }]});
  const removeItem = (idx) => setForm({...form, items: form.items.filter((_, i) => i !== idx)});
  const updateItem = (idx, field, val) => {
    const items = [...form.items];
    items[idx] = {...items[idx], [field]: field === 'quantity' ? parseInt(val) || 0 : val};
    setForm({...form, items});
  };

  const handleCreate = async () => {
    try {
      await createOrder(form);
      toast.success('Order created');
      setShowCreate(false);
      setForm({ customer_name: '', delivery_address: '', contact_phone: '', items: [{ tree_color: 'green', tree_size: '6ft', quantity: 10 }], delivery_date: '', notes: '' });
      fetchOrders();
    } catch (err) {
      toast.error('Failed to create order');
    }
  };

  const handleCheckFulfillment = async (orderId) => {
    try {
      const { data } = await checkOrderFulfillment(orderId);
      setFulfillmentData(data);
      setShowFulfillment(orderId);
    } catch (err) {
      toast.error('Failed to check fulfillment');
    }
  };

  const handleStatusChange = async (orderId, status) => {
    try {
      await updateOrder(orderId, { status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteOrder(id);
      toast.success('Order deleted');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const totalTrees = (items) => items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A1711] font-['Outfit'] tracking-tight">Orders</h1>
          <p className="text-sm text-[#4A5D53] mt-1">Manage customer orders and check stock fulfillment</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg" data-testid="create-order-button">
              <Plus className="w-4 h-4 mr-2" /> New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="create-order-dialog">
            <DialogHeader>
              <DialogTitle className="font-['Outfit']">Create Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} data-testid="order-customer-input" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>Delivery Address</Label>
                <Input value={form.delivery_address} onChange={e => setForm({...form, delivery_address: e.target.value})} data-testid="order-address-input" />
              </div>
              <div>
                <Label>Delivery Date</Label>
                <Input type="date" value={form.delivery_date} onChange={e => setForm({...form, delivery_date: e.target.value})} />
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  Order Items
                  <Button type="button" variant="ghost" size="sm" onClick={addItem} className="text-[#1A4331]" data-testid="add-order-item">
                    <Plus className="w-3 h-3 mr-1" /> Add Item
                  </Button>
                </Label>
                <div className="space-y-3 mt-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex items-end gap-2 bg-[#F4F1ED] p-3 rounded-lg">
                      <div className="flex-1">
                        <span className="text-xs text-[#4A5D53]">Colour</span>
                        <Select value={item.tree_color} onValueChange={v => updateItem(idx, 'tree_color', v)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COLORS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <span className="text-xs text-[#4A5D53]">Qty</span>
                        <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="bg-white" />
                      </div>
                      {form.items.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional" />
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#1A4331] text-white" data-testid="submit-order-button">Create Order</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-white" data-testid="filter-order-status"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#1A4331]/15 rounded-xl overflow-hidden" data-testid="orders-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F4F1ED]/50">
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Address</TableHead>
              <TableHead className="font-semibold">Items</TableHead>
              <TableHead className="font-semibold">Total Trees</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-[#4A5D53]">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No orders yet. Create your first order.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id} className="hover:bg-[#F4F1ED]/30 transition-colors">
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{o.delivery_address}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {o.items?.map((it, i) => (
                        <span key={i} className={`color-badge ${it.tree_color}`}>
                          {it.quantity}x {it.tree_color} {it.tree_size}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{totalTrees(o.items)}</TableCell>
                  <TableCell>
                    <span className={`status-badge ${o.status}`}>{o.status}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleCheckFulfillment(o.id)} title="Check Stock" data-testid={`check-fulfillment-${o.id}`}>
                        <CheckCircle className="w-4 h-4 text-[#1A4331]" />
                      </Button>
                      {o.status === 'pending' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(o.id, 'processing')} title="Start Processing">
                          <span className="text-xs text-blue-600 font-medium">Process</span>
                        </Button>
                      )}
                      {o.status === 'processing' && (
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(o.id, 'fulfilled')} title="Mark Fulfilled">
                          <span className="text-xs text-emerald-600 font-medium">Fulfill</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(o.id)} className="text-red-400" data-testid={`delete-order-${o.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Fulfillment Check Dialog */}
      <Dialog open={!!showFulfillment} onOpenChange={() => { setShowFulfillment(null); setFulfillmentData(null); }}>
        <DialogContent data-testid="fulfillment-dialog">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">Stock Fulfillment Check</DialogTitle>
          </DialogHeader>
          {fulfillmentData && (
            <div className="space-y-4 mt-2">
              <div className={`p-4 rounded-lg border ${fulfillmentData.can_fulfill ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {fulfillmentData.can_fulfill ? (
                    <><CheckCircle className="w-5 h-5 text-emerald-600" /><span className="font-semibold text-emerald-800">Can Fulfill Order</span></>
                  ) : (
                    <><XCircle className="w-5 h-5 text-red-600" /><span className="font-semibold text-red-800">Cannot Fulfill — Insufficient Stock</span></>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {fulfillmentData.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#1A4331]/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`color-badge ${item.tree_color}`}>{item.tree_color}</span>
                      <span className="text-sm">{item.tree_size}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{item.available}</span>
                      <span className="text-[#4A5D53]"> / {item.requested} needed</span>
                      {item.can_fulfill ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 inline ml-2" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 inline ml-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
