import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const api = axios.create({ baseURL: `${API}/api`, withCredentials: true });

// Colours / Stock
export const getColours = () => api.get('/colours');
export const createColour = (data) => api.post('/colours', data);
export const deleteColour = (id) => api.delete(`/colours/${id}`);
export const adjustStock = (data) => api.post('/stock/adjust', data);
export const getStockMovements = (params) => api.get('/stock/movements', { params });
export const getColourQR = (color) => api.get(`/colours/${color}/qr`);
export const checkStock = () => api.get('/stock/check');

// Yard Locations
export const getYardLocations = () => api.get('/yard-locations');
export const createYardLocation = (data) => api.post('/yard-locations', data);
export const deleteYardLocation = (id) => api.delete(`/yard-locations/${id}`);

// Orders
export const getOrders = (params) => api.get('/orders', { params });
export const createOrder = (data) => api.post('/orders', data);
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);
export const checkOrderFulfillment = (id) => api.post(`/orders/${id}/check-fulfillment`);

// Lorries
export const getLorries = () => api.get('/lorries');
export const createLorry = (data) => api.post('/lorries', data);
export const deleteLorry = (id) => api.delete(`/lorries/${id}`);

// Loads
export const getLoads = (params) => api.get('/loads', { params });
export const createLoad = (data) => api.post('/loads', data);
export const getLoad = (id) => api.get(`/loads/${id}`);
export const updateLoad = (id, data) => api.put(`/loads/${id}`, data);
export const addPalletToLoad = (loadId, data) => api.post(`/loads/${loadId}/add-pallet`, data);
export const removePalletFromLoad = (loadId, position) => api.post(`/loads/${loadId}/remove-pallet`, null, { params: { position } });
export const getManifest = (loadId) => api.get(`/loads/${loadId}/manifest`);

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');
