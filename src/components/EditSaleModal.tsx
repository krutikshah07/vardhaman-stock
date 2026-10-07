import React, { useState, useEffect } from 'react';
import { Pencil, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SaleRecord, SaleLocation } from '../types';
import { AutoCompleteInput } from './AutoCompleteInput';
import { inventoryService } from '../services/inventoryService';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: {
    customerName: string;
    companyName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
  }) => void;
  sale: SaleRecord | null;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({ isOpen, onClose, onConfirm, sale }) => {
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [location, setLocation] = useState<SaleLocation>('upper');
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      inventoryService.getCustomerSuggestions().then(({ customers, companies }) => {
        setCustomerSuggestions(customers);
        setCompanySuggestions(companies);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customerName || '');
      setCompanyName(sale.companyName || '');
      setQuantity(String(sale.quantity || 1));
      setUnitPrice(String(sale.unitPrice || 0));
      setLocation(sale.location || 'upper');
    }
  }, [sale]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      customerName: customerName.trim(),
      companyName: companyName.trim(),
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
      {isOpen && sale && (
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
                      <h3 className="text-lg font-black text-slate-900 uppercase">Edit Sale Entry</h3>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{sale.itemName}</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Customer Name
                      </label>
                      <AutoCompleteInput
                        required
                        value={customerName}
                        onChange={setCustomerName}
                        suggestions={customerSuggestions}
                        placeholder="e.g. John Doe"
                        className="py-2.5 pr-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Company Name
                      </label>
                      <AutoCompleteInput
                        value={companyName}
                        onChange={setCompanyName}
                        suggestions={companySuggestions}
                        placeholder="e.g. Apex Corp"
                        className="py-2.5 pr-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold uppercase"
                      />
                    </div>
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
                      Office / Location
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
                    <span className="text-emerald-700 text-base font-black">
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

