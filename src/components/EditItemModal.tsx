import React, { useState, useEffect } from 'react';
import { Pencil, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../types';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: { name: string; price: number; boxPacking: string }) => void;
  item: InventoryItem | null;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({ isOpen, onClose, onConfirm, item }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [boxPacking, setBoxPacking] = useState('');

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(String(item.price));
      setBoxPacking(item.boxPacking || '');
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      name,
      price: Number(price) || 0,
      boxPacking: boxPacking.toUpperCase().trim()
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <Pencil size={24} />
                  </div>
                  <button 
                    type="button"
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-slate-950">Edit Item Details</h3>
                {item && (
                  <p className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg w-fit mt-1.5 mb-5 uppercase tracking-wider">
                    Editing: {item.name}
                  </p>
                )}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase px-1">Item Name</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase px-1">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase px-1">Box Packing</label>
                    <input
                      type="text"
                      placeholder="E.G. 50 PCS / BOX"
                      value={boxPacking}
                      onChange={(e) => setBoxPacking(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium uppercase placeholder:text-slate-300"
                    />
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
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  <span>Update Item</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
