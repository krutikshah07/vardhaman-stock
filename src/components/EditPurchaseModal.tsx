import React, { useState, useEffect } from 'react';
import { Pencil, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PurchaseRecord, SaleLocation } from '../types';
import { AutoCompleteInput } from './AutoCompleteInput';
import { inventoryService } from '../services/inventoryService';

interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: {
    supplierName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
  }) => void;
  purchase: PurchaseRecord | null;
}

export const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({ isOpen, onClose, onConfirm, purchase }) => {
  const [supplierName, setSupplierName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [location, setLocation] = useState<SaleLocation>('upper');
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      inventoryService.getSupplierSuggestions().then(setSupplierSuggestions);
    }
  }, [isOpen]);

  useEffect(() => {
    if (purchase) {
      setSupplierName(purchase.supplierName || '');
      setQuantity(String(purchase.quantity || 1));
      setUnitPrice(String(purchase.unitPrice || 0));
      setLocation(purchase.location || 'upper');
    }
  }, [purchase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      supplierName: supplierName.trim(),
      quantity: Math.max(1, Number(quantity) || 1),
      unitPrice: Math.max(0, Number(unitPrice) || 0),
      location,
    });
  };

  const parsedQty = Math.max(0, Number(quantity) || 0);
  const parsedPrice = Math.max(0, Number(unitPrice) || 0);
  const calculatedTotal = parsedQty * parsedPrice;

  return (
    <AnimatePresence>
      {isOpen && purchase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <Pencil size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase">Edit Purchase Entry</h3>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{purchase.itemName}</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Supplier Name
                    </label>
                    <AutoCompleteInput
                      required
                      value={supplierName}
                      onChange={setSupplierName}
                      suggestions={supplierSuggestions}
                      placeholder="e.g. Standard Wire Mills"
                      className="py-2.5 pr-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Office / Receiving Location
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['upper', 'down', 'nagdevi'] as const).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setLocation(loc)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                            location === loc
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {loc} Office
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400 uppercase tracking-wider">Calculated Total</span>
                    <span className="text-amber-700 text-base font-black">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(calculatedTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 flex flex-col sm:flex-row gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

