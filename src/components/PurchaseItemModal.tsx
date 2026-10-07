import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, IndianRupee, Package, ShoppingBag, UserRound, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, SaleLocation } from '../types';
import { AutoCompleteInput } from './AutoCompleteInput';
import { inventoryService } from '../services/inventoryService';

interface PurchaseItemModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  preferredLocation: SaleLocation;
  onClose: () => void;
  onConfirm: (purchase: {
    itemId: string;
    itemName: string;
    supplierName: string;
    boxPacking?: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
    purchasedAt: Date;
    totalAmount: number;
    notes?: string;
  }) => void;
}

const locationLabel: Record<SaleLocation, string> = {
  upper: 'Upper Office',
  down: 'Down Office',
  nagdevi: 'Nagdevi Office',
};

export const PurchaseItemModal: React.FC<PurchaseItemModalProps> = ({ isOpen, item, preferredLocation, onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [supplierName, setSupplierName] = useState('');
  const [boxPacking, setBoxPacking] = useState(item?.boxPacking || '');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<SaleLocation>(preferredLocation);
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      inventoryService.getSupplierSuggestions().then(setSupplierSuggestions);
    }
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      const today = new Date().toISOString().slice(0, 10);
      setLocation(preferredLocation);
      setUnitPrice(item.price || 0);
      setQuantity(1);
      setSupplierName('');
      setBoxPacking(item.boxPacking || '');
      setNotes('');
      setPurchasedAt(today);
    }
  }, [item, preferredLocation, isOpen]);

  const parsedQuantity = Number(quantity) || 0;
  const totalAmount = parsedQuantity * unitPrice;
  const isSupplierInvalid = !supplierName.trim();
  const isQuantityInvalid = parsedQuantity <= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const cleanQuantity = Number(quantity) || 0;
    const cleanSupplier = supplierName.trim();
    const cleanUnitPrice = Number(unitPrice) || 0;

    if (!cleanSupplier || cleanQuantity <= 0) return;

    onConfirm({
      itemId: item.id,
      itemName: item.name,
      supplierName: cleanSupplier,
      boxPacking: boxPacking.trim().toUpperCase(),
      quantity: cleanQuantity,
      unitPrice: cleanUnitPrice,
      location,
      purchasedAt: new Date(`${purchasedAt}T00:00:00`),
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
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <ShoppingBag size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Record Purchase</h3>
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
                        onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                      />
                      {isQuantityInvalid && (
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-1">Quantity must be greater than 0</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Unit Cost</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Supplier</label>
                      <AutoCompleteInput
                        value={supplierName}
                        onChange={setSupplierName}
                        suggestions={supplierSuggestions}
                        placeholder="ABC Traders"
                        icon={<UserRound size={14} />}
                        className="py-2.5 pr-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold uppercase text-xs"
                      />
                      {isSupplierInvalid && (
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-1">Supplier is required</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Location</label>
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value as SaleLocation)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                      >
                        {Object.entries(locationLabel).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Box Packing</label>
                    <input
                      type="text"
                      value={boxPacking}
                      onChange={(e) => setBoxPacking(e.target.value.toUpperCase())}
                      placeholder="e.g. A1"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="date"
                        value={purchasedAt}
                        onChange={(e) => setPurchasedAt(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional notes / bill / delivery details"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold resize-none"
                    />
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-blue-700">
                      <span>Receive in {locationLabel[location]}</span>
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
                  disabled={parsedQuantity <= 0 || !supplierName.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Purchase
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
