import React, { useState, useEffect } from 'react';
import { Plus, List, Tag } from 'lucide-react';

interface CategorySelectProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  categories = [],
  value,
  onChange,
  label = 'Category / Model',
  className = ''
}) => {
  // If the current value is not in existing categories and is non-empty, default to custom mode
  const isExisting = !value || categories.includes(value.toUpperCase().trim());
  const [isCustomMode, setIsCustomMode] = useState(!isExisting && categories.length > 0);

  useEffect(() => {
    if (value && !categories.includes(value.toUpperCase().trim())) {
      setIsCustomMode(true);
    }
  }, [value, categories]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__NEW__') {
      setIsCustomMode(true);
      onChange('');
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.toUpperCase());
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Tag size={12} className="text-blue-600" />
          {label}
        </label>
        {categories.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(!isCustomMode);
              if (isCustomMode && !categories.includes(value)) {
                onChange('');
              }
            }}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider flex items-center gap-1 transition-colors"
          >
            {isCustomMode ? (
              <>
                <List size={11} /> Pick from List
              </>
            ) : (
              <>
                <Plus size={11} /> + Type New
              </>
            )}
          </button>
        )}
      </div>

      {/* Main Selector: Either Dropdown or Text Input */}
      {isCustomMode || categories.length === 0 ? (
        <div className="relative">
          <input
            type="text"
            autoFocus={isCustomMode}
            placeholder="TYPE CATEGORY (E.G. MK-12, VILLIERS)"
            value={value}
            onChange={handleCustomInputChange}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-bold uppercase placeholder:text-slate-300 text-xs"
          />
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={handleSelectChange}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-bold uppercase text-slate-800 text-xs cursor-pointer appearance-none pr-8"
          >
            <option value="">— Select Category (or leave empty) —</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="__NEW__">+ Type New Category...</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs font-bold">
            ▼
          </div>
        </div>
      )}
    </div>
  );
};

