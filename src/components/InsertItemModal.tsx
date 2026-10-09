import React, { useState, useEffect } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../types';

interface InsertItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: {
    name: string;
    price: number;
    boxPacking: string;
    category?: string;
    upper: number;
    down: number;
    nagdevi: number;
  }) => void;
  itemBelow: InventoryItem | null;
}

export const InsertItemModal: React.FC<InsertItemModalProps> = ({ isOpen, onClose, onConfirm, itemBelow }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [boxPacking, setBoxPacking] = useState('');
  const [category, setCategory] = useState('');
  const [upper, setUpper] = useState('');
  const [down, setDown] = useState('');
  const [nagdevi, setNagdevi] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPrice('');
      setBoxPacking('');
      setCategory(itemBelow?.category || '');
      setUpper('');
      setDown('');
      setNagdevi('');
    }
  }, [isOpen, itemBelow]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      name: name.toUpperCase().trim(),
      price: Number(price) || 0,
      boxPacking: boxPacking.toUpperCase().trim(),
      category: category.toUpperCase().trim(),
      upper: Number(upper) || 0,
      down: Number(down) || 0,
      nagdevi: Number(nagdevi) || 0
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
            className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                    <Plus size={24} />
                  </div>
                  <button 
                    type="button"
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-slate-950">Insert New Item</h3>
                {itemBelow && (
                  <p className="text-xs font-black text-green-700 bg-green-50 border border-green-100 px-2.5 py-1.5 rounded-lg w-fit mt-1.5 mb-5 uppercase tracking-wider">
                    Inserting directly below: {itemBelow.name}
                  </p>
                )}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase px-1">Category / Model (e.g. MK-12, VILLIERS)</label>
                    <input
                      type="text"
                      placeholder="E.G. MK-12, VILLIERS, PETROL"
                      value={category}
                      onChange={(e) => setCategory(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium uppercase placeholder:text-slate-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase px-1">Item Name</label>
                    <input
                      required
                      autoFocus
                      type="text"
                      placeholder="E.G. BRASS NUT 1/2"
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium uppercase"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase px-1">Price (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase px-1">Box Packing</label>
                      <input
                        type="text"
                        placeholder="E.G. 50 PCS"
                        value={boxPacking}
                        onChange={(e) => setBoxPacking(e.target.value.toUpperCase())}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium uppercase placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Initial Stock Quantities</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Upper Office</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={upper}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setUpper(e.target.value.replace(/^0+(?=\d)/, ''))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-center font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Down Office</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={down}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setDown(e.target.value.replace(/^0+(?=\d)/, ''))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-center font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nagdevi</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={nagdevi}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setNagdevi(e.target.value.replace(/^0+(?=\d)/, ''))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  <span>Insert Item</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
