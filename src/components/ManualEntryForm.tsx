import React, { useState } from 'react';
import { Plus, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManualEntryFormProps {
  onAdd: (item: { name: string; price: string; boxPacking: string; upper: string; down: string; nagdevi: string }) => Promise<void>;
  isProcessing: boolean;
}

export const ManualEntryForm: React.FC<ManualEntryFormProps> = React.memo(({ onAdd, isProcessing }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    boxPacking: '',
    upper: '',
    down: '',
    nagdevi: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || isProcessing) return;
    
    await onAdd(newItem);
    setNewItem({ name: '', price: '', boxPacking: '', upper: '', down: '', nagdevi: '' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/80 transition-colors select-none group"
      >
        <h3 className="font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
          <Plus size={20} className="text-blue-600" />
          Manual Entry
        </h3>
        <div className="p-2 text-slate-400 group-hover:text-blue-600 transition-colors">
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="E.G. BRASS BUSH 1/2"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase placeholder:text-slate-300 font-bold"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Box Packing</label>
                    <input
                      type="text"
                      placeholder="E.G. 50 PCS / BOX"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold uppercase placeholder:text-slate-300"
                      value={newItem.boxPacking}
                      onChange={(e) => setNewItem({ ...newItem, boxPacking: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Upper Office</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="QTY"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      value={newItem.upper}
                      onChange={(e) => setNewItem({ ...newItem, upper: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Down Office</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="QTY"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      value={newItem.down}
                      onChange={(e) => setNewItem({ ...newItem, down: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nagdevi Office</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="QTY"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      value={newItem.nagdevi}
                      onChange={(e) => setNewItem({ ...newItem, nagdevi: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus size={20} />
                    Add to list
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
