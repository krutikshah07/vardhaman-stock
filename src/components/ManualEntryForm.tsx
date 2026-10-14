import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, ChevronUp, ChevronDown, Loader2, X, ArrowDownToLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../types';
import { CategorySelect } from './CategorySelect';

interface ManualEntryFormProps {
  items?: InventoryItem[];
  onAdd: (item: { 
    name: string; 
    price: string; 
    boxPacking: string; 
    category?: string; 
    upper: string; 
    down: string; 
    nagdevi: string;
    insertAfterId?: string;
  }) => Promise<void>;
  isProcessing: boolean;
}

export const ManualEntryForm: React.FC<ManualEntryFormProps> = React.memo(({ items = [], onAdd, isProcessing }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    boxPacking: '',
    category: '',
    upper: '',
    down: '',
    nagdevi: ''
  });

  const [insertAfterQuery, setInsertAfterQuery] = useState('');
  const [selectedItemBelow, setSelectedItemBelow] = useState<InventoryItem | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!items || items.length === 0) return [];
    const query = insertAfterQuery.trim().toLowerCase();
    if (!query) return items.slice(0, 30);
    return items.filter(i => 
      i.name.toLowerCase().includes(query) || 
      (i.category && i.category.toLowerCase().includes(query))
    ).slice(0, 30);
  }, [items, insertAfterQuery]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || isProcessing) return;
    
    await onAdd({
      ...newItem,
      insertAfterId: selectedItemBelow ? selectedItemBelow.id : undefined,
    });
    setNewItem({ name: '', price: '', boxPacking: '', category: '', upper: '', down: '', nagdevi: '' });
    setSelectedItemBelow(null);
    setInsertAfterQuery('');
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CategorySelect
                    categories={categories}
                    value={newItem.category}
                    onChange={(cat) => setNewItem({ ...newItem, category: cat })}
                  />
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="E.G. BRASS BUSH 1/2"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase placeholder:text-slate-300 font-bold"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value.toUpperCase() })}
                    />
                  </div>
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
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value.replace(/^0+(?=\d)/, '') })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Box Packing</label>
                    <input
                      type="text"
                      placeholder="E.G. 50 PCS / BOX"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold uppercase placeholder:text-slate-300"
                      value={newItem.boxPacking}
                      onChange={(e) => setNewItem({ ...newItem, boxPacking: e.target.value.toUpperCase() })}
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
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setNewItem({ ...newItem, upper: e.target.value.replace(/^0+(?=\d)/, '') })}
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
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setNewItem({ ...newItem, down: e.target.value.replace(/^0+(?=\d)/, '') })}
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
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setNewItem({ ...newItem, nagdevi: e.target.value.replace(/^0+(?=\d)/, '') })}
                    />
                  </div>
                </div>

                <div className="relative pt-2 border-t border-slate-100" ref={dropdownRef}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <ArrowDownToLine size={13} className="text-blue-600" />
                      Place After Item (Optional Position)
                    </label>
                    {selectedItemBelow && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemBelow(null);
                          setInsertAfterQuery('');
                        }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider flex items-center gap-1"
                      >
                        <X size={12} /> Clear Position
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Leave empty for Auto / Alphabetical, or type item name..."
                      value={insertAfterQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInsertAfterQuery(val);
                        setIsDropdownOpen(true);
                        if (selectedItemBelow && val.toUpperCase().trim() !== selectedItemBelow.name) {
                          setSelectedItemBelow(null);
                        }
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase placeholder:text-slate-300 font-bold text-xs"
                    />
                    {selectedItemBelow && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-200 pointer-events-none">
                        <span>After: {selectedItemBelow.name}</span>
                      </div>
                    )}
                  </div>

                  {isDropdownOpen && filteredSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                      <div 
                        onClick={() => {
                          setSelectedItemBelow(null);
                          setInsertAfterQuery('');
                          setIsDropdownOpen(false);
                        }}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs font-bold text-slate-500"
                      >
                        <span>Auto (Alphabetical Order)</span>
                        {!selectedItemBelow && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Selected</span>}
                      </div>
                      {filteredSuggestions.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItemBelow(item);
                            setInsertAfterQuery(item.name);
                            setIsDropdownOpen(false);
                          }}
                          className={`p-3 hover:bg-emerald-50/50 cursor-pointer flex items-center justify-between text-xs ${selectedItemBelow?.id === item.id ? 'bg-emerald-50 font-black text-emerald-800' : 'text-slate-700 font-bold'}`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {item.category && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-600 shrink-0">
                                {item.category}
                              </span>
                            )}
                            <span className="truncate">{item.name}</span>
                          </div>
                          {selectedItemBelow?.id === item.id && (
                            <span className="text-[10px] font-black text-emerald-600 shrink-0">Selected</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedItemBelow ? (
                    <p className="mt-1.5 text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      ✓ Will be inserted directly after <strong>{selectedItemBelow.name}</strong>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                      Leave empty to place automatically by alphabetical order.
                    </p>
                  )}
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
