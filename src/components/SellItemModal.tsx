import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, IndianRupee, Package, ShoppingCart, UserRound, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, SaleLocation } from '../types';

interface SellItemModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  preferredLocation: SaleLocation;
  onClose: () => void;
  onConfirm: (sale: {
    itemId: string;
    itemName: string;
    customerName: string;
    companyName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
    soldAt: Date;
    totalAmount: number;
    notes?: string;
  }) => void;
}

const locationLabel: Record<SaleLocation, string> = {
  upper: 'Upper Office',
  down: 'Down Office',
  nagdevi: 'Nagdevi Office',
};

export const SellItemModal: React.FC<SellItemModalProps> = ({ isOpen, item, preferredLocation, onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<SaleLocation>(preferredLocation);
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (item) {
      const today = new Date().toISOString().slice(0, 10);
      setLocation(preferredLocation);
      setUnitPrice(item.price || 0);
      setQuantity(1);
      setCompanyName('');
      setCustomerName('');
      setNotes('');
      setSoldAt(today);
    }
  }, [item, preferredLocation, isOpen]);

  const availableQty = useMemo(() => {
    if (!item) return 0;
    if (location === 'upper') return item.upperOfficeQty || 0;
    if (location === 'down') return item.downOfficeQty || 0;
    return item.nagdeviOfficeQty || 0;
  }, [item, location]);

  const parsedQuantity = Number(quantity) || 0;
  const totalAmount = parsedQuantity * unitPrice;
  const isQuantityInvalid = parsedQuantity <= 0 || parsedQuantity > availableQty;
  const isCustomerInvalid = !customerName.trim();
  const isCompanyInvalid = !companyName.trim();
  const quantityErrorText = availableQty <= 0
    ? 'No stock available in this office'
    : parsedQuantity > availableQty
      ? `Entered quantity exceeds the available stock in ${locationLabel[location]}. Only ${availableQty} units available.`
      : `Quantity must be between 1 and ${availableQty}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const cleanQuantity = Number(quantity) || 0;
    const cleanUnitPrice = Number(unitPrice) || 0;
    const cleanCustomer = customerName.trim();
    const cleanCompany = companyName.trim();

    if (!cleanCustomer || !cleanCompany || cleanQuantity <= 0 || cleanQuantity > availableQty) return;

    onConfirm({
      itemId: item.id,
      itemName: item.name,
      customerName: cleanCustomer,
      companyName: cleanCompany,
      quantity: cleanQuantity,
      unitPrice: cleanUnitPrice,
      location,
      soldAt: new Date(`${soldAt}T00:00:00`),
      totalAmount: cleanQuantity * cleanUnitPrice,
      notes: notes.trim(),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && item && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <ShoppingCart size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Record Sale</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.name}</p>
                    </div>
                  </div>
                  <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => {
                          const nextValue = e.target.value === '' ? '' : Number(e.target.value);
                          setQuantity(nextValue);
                        }}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold"
                      />
                      {isQuantityInvalid && (
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-1">
                          {quantityErrorText}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Unit Price</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Customer</label>
                      <div className="relative">
                        <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="John / Rahul"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold uppercase"
                        />
                        {isCustomerInvalid && (
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-1">Customer is required</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Company</label>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="ABC TRADING"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold uppercase"
                        />
                        {isCompanyInvalid && (
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-1">Company is required</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Location</label>
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value as SaleLocation)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold"
                      >
                        {Object.entries(locationLabel).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date</label>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="date"
                          value={soldAt}
                          onChange={(e) => setSoldAt(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional notes / address / delivery details"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold resize-none"
                    />
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      <span>Available in {locationLabel[location]}</span>
                      <span>{availableQty} units</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm font-black text-slate-900">
                      <span>Total</span>
                      <span>₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parsedQuantity <= 0 || parsedQuantity > availableQty || !companyName.trim() || !customerName.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Sale
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
