import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Search, Plus, Minus, Trash2, TrendingDown, TrendingUp, PackageSearch, Pencil, Loader2, Calendar, FileSpreadsheet, Database, Download, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { InventoryItem, SaleLocation } from '../types';
import { inventoryService, subscribeToDatabaseProvider, DatabaseProvider } from '../services/inventoryService';
import { motion, AnimatePresence } from 'motion/react';
import { DeleteModal } from './DeleteModal';
import { EditItemModal } from './EditItemModal';
import { InsertItemModal } from './InsertItemModal';
import { SellItemModal } from './SellItemModal';
import { PurchaseItemModal } from './PurchaseItemModal';
import { StatusModal, StatusType } from './StatusModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { formatQuantity, parseQuantity } from '../utils/quantity';

interface InventoryTableProps {
  items: InventoryItem[];
  setItems?: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  locationFilter: 'all' | 'upper' | 'down' | 'nagdevi';
  onFilterChange: (filter: 'all' | 'upper' | 'down' | 'nagdevi') => void;
}

const BoxPackingInput = React.memo(({
  item,
  handleSetBoxPacking,
  isLastUpdated
}: {
  item: InventoryItem;
  handleSetBoxPacking: (item: InventoryItem, value: string) => void;
  isLastUpdated?: boolean;
}) => {
  const [val, setVal] = React.useState(item.boxPacking || '');
  const [isFocused, setIsFocused] = React.useState(false);
  const [isFlash, setIsFlash] = React.useState(false);
  const prevValueRef = React.useRef(item.boxPacking || '');

  React.useEffect(() => {
    setVal(item.boxPacking || '');
    if ((item.boxPacking || '') !== prevValueRef.current) {
      setIsFlash(true);
      const timer = setTimeout(() => setIsFlash(false), 2500);
      prevValueRef.current = item.boxPacking || '';
      return () => clearTimeout(timer);
    }
  }, [item.boxPacking]);

  const handleBlurOrEnter = () => {
    setIsFocused(false);
    const trimmed = val.toUpperCase().trim();
    if (trimmed !== (item.boxPacking || '')) {
      handleSetBoxPacking(item, trimmed);
    }
  };

  const isDirty = val.toUpperCase().trim() !== (item.boxPacking || '').toUpperCase().trim();

  let classNames = "w-36 px-2.5 py-1.5 text-xs font-bold uppercase rounded-lg transition-all placeholder:text-slate-300 outline-none ";
  if (isFlash) {
    classNames += "bg-emerald-100 text-emerald-800 border-2 border-emerald-500 ring-2 ring-emerald-500/20 scale-102 animate-pulse";
  } else if (isFocused && isDirty) {
    classNames += "bg-amber-50 text-amber-900 border-2 border-amber-500 ring-2 ring-amber-500/20";
  } else if (isFocused) {
    classNames += "bg-white text-slate-800 border-2 border-indigo-500 ring-2 ring-indigo-500/15";
  } else if (isDirty) {
    classNames += "bg-amber-50/55 text-slate-800 border border-amber-300";
  } else if (isLastUpdated) {
    classNames += "bg-emerald-50 text-emerald-900 border-2 border-emerald-400";
  } else {
    classNames += "bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300";
  }

  return (
    <input
      type="text"
      value={val}
      placeholder="—"
      onChange={(e) => setVal(e.target.value.toUpperCase())}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlurOrEnter}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlurOrEnter();
          e.currentTarget.blur();
        }
      }}
      className={classNames}
    />
  );
});

const InlineQtyInput = React.memo(({
  value,
  onChange,
  className = "w-12 text-center text-xs font-black bg-transparent border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-800",
  isLastUpdated
}: {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  isLastUpdated?: boolean;
}) => {
  const [tempVal, setTempVal] = React.useState<string>(formatQuantity(value));
  const [isFocused, setIsFocused] = React.useState(false);
  const [isFlash, setIsFlash] = React.useState(false);
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    setTempVal(formatQuantity(value));
    if (value !== prevValueRef.current) {
      setIsFlash(true);
      const timer = setTimeout(() => setIsFlash(false), 2500);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, spaces, hyphens, dots, and slashes for fractions
    if (/^[0-9\s.\-\/]*$/.test(raw)) {
      setTempVal(raw);
    }
  };

  const handleBlurOrEnter = () => {
    setIsFocused(false);
    const finalVal = parseQuantity(tempVal);
    if (finalVal !== value) {
      onChange(finalVal);
    } else {
      setTempVal(formatQuantity(value));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const isDirty = tempVal !== "" && parseQuantity(tempVal) !== value;

  let cleanClass = className
    .replace('bg-transparent', '')
    .replace('border-0', '')
    .replace('text-slate-800', '')
    .replace('text-blue-600', '')
    .replace('border-slate-200', '');

  let statusStyles = "";
  if (isFlash) {
    statusStyles = "bg-emerald-500/15 text-emerald-800 font-black border-2 border-emerald-500 rounded px-1.5 py-0.5 animate-pulse ";
  } else if (isFocused && isDirty) {
    statusStyles = "bg-amber-50 text-amber-900 font-black border-2 border-amber-500 rounded px-1.5 py-0.5 ";
  } else if (isFocused) {
    statusStyles = "bg-indigo-50 text-indigo-700 font-black border-2 border-indigo-500 rounded px-1.5 py-0.5 ";
  } else if (isDirty) {
    statusStyles = "bg-amber-50/50 text-slate-900 border border-amber-300 rounded px-1.5 py-0.5 ";
  } else if (isLastUpdated) {
    statusStyles = "bg-emerald-50 text-emerald-900 font-black border border-emerald-400 rounded px-1.5 py-0.5 ";
  } else {
    statusStyles = "text-slate-800 ";
  }

  return (
    <input
      type="text"
      value={tempVal}
      placeholder="—"
      onChange={handleChange}
      onBlur={handleBlurOrEnter}
      onFocus={handleFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlurOrEnter();
          e.currentTarget.blur();
        }
      }}
      className={`${cleanClass} ${statusStyles} transition-all duration-300`}
    />
  );
});

const InlinePriceInput = React.memo(({
  value,
  onChange,
  className = "w-20 font-mono text-sm font-bold bg-transparent border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-800",
  isLastUpdated
}: {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  isLastUpdated?: boolean;
}) => {
  const [tempVal, setTempVal] = React.useState<string>(String(value));
  const [isFocused, setIsFocused] = React.useState(false);
  const [isFlash, setIsFlash] = React.useState(false);
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    setTempVal(String(value));
    if (value !== prevValueRef.current) {
      setIsFlash(true);
      const timer = setTimeout(() => setIsFlash(false), 2500);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (raw === "") {
      setTempVal("");
    } else {
      raw = raw.replace(/^0+(?=\d)/, '');
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0) {
        setTempVal(raw);
      }
    }
  };

  const handleBlurOrEnter = () => {
    setIsFocused(false);
    const finalVal = tempVal === "" ? 0 : parseFloat(tempVal);
    if (!isNaN(finalVal) && finalVal !== value) {
      onChange(finalVal);
    } else {
      setTempVal(String(value));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const isDirty = tempVal !== "" && parseFloat(tempVal) !== value;

  let containerClass = "inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl hover:border-slate-300 transition-all focus-within:ring-2 focus-within:ring-indigo-500/15 focus-within:border-indigo-500 focus-within:bg-white ";
  if (isFlash) {
    containerClass = "inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-800 font-bold border-2 border-emerald-500 px-2.5 py-1.5 rounded-xl animate-pulse ";
  } else if (isFocused && isDirty) {
    containerClass = "inline-flex items-center gap-1 bg-amber-50 text-amber-900 font-bold border-2 border-amber-500 px-2.5 py-1.5 rounded-xl ";
  } else if (isFocused) {
    containerClass = "inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-bold border-2 border-indigo-500 px-2.5 py-1.5 rounded-xl ";
  } else if (isDirty) {
    containerClass = "inline-flex items-center gap-1 bg-amber-50/50 text-slate-900 border border-amber-300 px-2.5 py-1.5 rounded-xl ";
  } else if (isLastUpdated) {
    containerClass = "inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 font-bold border-2 border-emerald-500/40 px-2.5 py-1.5 rounded-xl ";
  }

  return (
    <div className={`${containerClass} transition-all duration-300`}>
      <span className="text-sm font-mono text-slate-500 font-bold select-none">₹</span>
      <input
        type="number"
        min="0"
        step="any"
        value={tempVal}
        onChange={handleChange}
        onBlur={handleBlurOrEnter}
        onFocus={handleFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleBlurOrEnter();
            e.currentTarget.blur();
          }
        }}
        className={className}
      />
    </div>
  );
});

const InventoryRow = React.memo(({ 
  item, 
  locationFilter, 
  handleUpdateOfficeQty, 
  handleSetOfficeQty,
  handleSetBoxPacking,
  handleSetPrice,
  handleEditClick, 
  handleDeleteClick,
  handleInsertBelowClick,
  handleSellClick,
  handlePurchaseClick,
  isEditing,
  isLastUpdated
}: { 
  item: InventoryItem; 
  locationFilter: 'all' | 'upper' | 'down' | 'nagdevi'; 
  handleUpdateOfficeQty: (item: InventoryItem, office: 'upper' | 'down' | 'nagdevi', delta: number) => void;
  handleSetOfficeQty: (item: InventoryItem, office: 'upper' | 'down' | 'nagdevi', value: number) => void;
  handleSetBoxPacking: (item: InventoryItem, value: string) => void;
  handleSetPrice: (item: InventoryItem, value: number) => void;
  handleEditClick: (item: InventoryItem) => void;
  handleDeleteClick: (item: InventoryItem) => void;
  handleInsertBelowClick: (item: InventoryItem) => void;
  handleSellClick: (item: InventoryItem) => void;
  handlePurchaseClick: (item: InventoryItem, office: SaleLocation) => void;
  isEditing?: boolean;
  isLastUpdated?: boolean;
}) => (
  <tr
    style={{ contentVisibility: 'auto' as any, containIntrinsicSize: '68px' }}
    className={`group transition-colors duration-150 border-l-4 ${
      isEditing 
        ? "bg-indigo-50 border-indigo-500 shadow-[inset_0_1px_3px_rgba(99,102,241,0.05)]" 
        : isLastUpdated 
        ? "bg-emerald-100/85 border-emerald-500 font-bold z-10" 
        : "hover:bg-slate-50/65 border-transparent focus-within:bg-blue-50/70 focus-within:border-blue-400 focus-within:shadow-sm focus-within:z-10"
    }`}
  >
    <td className={`px-6 py-4 sticky left-0 z-20 border-r border-slate-200 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.02)] w-[380px] min-w-[320px] max-w-[460px] ${
      isEditing 
        ? "bg-indigo-50" 
        : isLastUpdated 
        ? "bg-emerald-100" 
        : "bg-white group-hover:bg-slate-50/95 group-focus-within:bg-blue-50/95"
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        {item.category && (
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700 tracking-wider shrink-0 border border-indigo-200/60 shadow-xs">
            {item.category}
          </span>
        )}
        <p className="font-bold text-slate-900 text-sm leading-snug break-words whitespace-normal">{item.name}</p>
      </div>
      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
        UPDATED {item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '27 JUL 2026'}
      </p>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <InlinePriceInput key={`price-${item.id}`} value={item.price} onChange={(val) => handleSetPrice(item, val)} isLastUpdated={isLastUpdated} />
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <BoxPackingInput key={`packing-${item.id}`} item={item} handleSetBoxPacking={handleSetBoxPacking} isLastUpdated={isLastUpdated} />
    </td>

    {locationFilter === 'all' && (
      <>
        <td className="px-6 py-4 bg-blue-50/20 whitespace-nowrap min-w-[120px]">
          <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded-md text-xs font-black ${
              item.quantity <= 5 ? 'bg-red-50 text-red-600' : 
              item.quantity <= 15 ? 'bg-amber-50 text-amber-600' : 
              'bg-blue-50 text-blue-600'
            }`}>
              {item.quantity} TOTAL
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-inner w-fit">
            <button onClick={() => handleSellClick(item)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-red-500 transition-colors active:scale-95" title="Record sale">
              <Minus size={12} />
            </button>
            <InlineQtyInput 
              key={`qty-upper-${item.id}`}
              value={item.upperOfficeQty || 0}
              onChange={(val) => handleSetOfficeQty(item, 'upper', val)}
              className="w-12 text-center text-xs font-black bg-transparent border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-800"
              isLastUpdated={isLastUpdated}
            />
            <button onClick={() => handlePurchaseClick(item, 'upper')} className="p-1 hover:bg-white rounded text-slate-500 hover:text-green-600 transition-colors active:scale-95">
              <Plus size={12} />
            </button>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap min-w-[150px]">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-inner w-fit">
            <button onClick={() => handleSellClick(item)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-red-500 transition-colors active:scale-95" title="Record sale">
              <Minus size={12} />
            </button>
            <InlineQtyInput 
              key={`qty-down-${item.id}`}
              value={item.downOfficeQty || 0}
              onChange={(val) => handleSetOfficeQty(item, 'down', val)}
              className="w-12 text-center text-xs font-black bg-transparent border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-800"
              isLastUpdated={isLastUpdated}
            />
            <button onClick={() => handlePurchaseClick(item, 'down')} className="p-1 hover:bg-white rounded text-slate-500 hover:text-green-600 transition-colors active:scale-95">
              <Plus size={12} />
            </button>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap min-w-[150px]">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-inner w-fit">
            <button onClick={() => handleSellClick(item)} className="p-1 hover:bg-white rounded text-slate-500 hover:text-red-500 transition-colors active:scale-95" title="Record sale">
              <Minus size={12} />
            </button>
            <InlineQtyInput 
              key={`qty-nagdevi-${item.id}`}
              value={item.nagdeviOfficeQty || 0}
              onChange={(val) => handleSetOfficeQty(item, 'nagdevi', val)}
              className="w-12 text-center text-xs font-black bg-transparent border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-800"
              isLastUpdated={isLastUpdated}
            />
            <button onClick={() => handlePurchaseClick(item, 'nagdevi')} className="p-1 hover:bg-white rounded text-slate-500 hover:text-green-600 transition-colors active:scale-95">
              <Plus size={12} />
            </button>
          </div>
        </td>
      </>
    )}

    {locationFilter === 'upper' && (
      <td className="px-6 py-4 bg-blue-50/20 whitespace-nowrap">
        <div className="flex items-center gap-3 font-bold text-slate-900">
          <button onClick={() => handleSellClick(item)} className="p-2 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-all active:scale-90 bg-slate-50 flex items-center justify-center" title="Record sale">
            <Minus size={16} />
          </button>
          <div className="min-w-[70px] text-center">
            <InlineQtyInput 
              key={`qty-upper-single-${item.id}`}
              value={item.upperOfficeQty || 0}
              onChange={(val) => handleSetOfficeQty(item, 'upper', val)}
              className="w-16 text-center text-2xl font-black text-blue-600 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              isLastUpdated={isLastUpdated}
            />
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">In Upper</p>
          </div>
          <button onClick={() => handlePurchaseClick(item, 'upper')} className="p-2 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-all active:scale-90 bg-slate-50 flex items-center justify-center">
            <Plus size={16} />
          </button>
        </div>
      </td>
    )}

    {locationFilter === 'down' && (
      <td className="px-6 py-4 bg-blue-50/20 whitespace-nowrap">
        <div className="flex items-center gap-3 font-bold text-slate-900">
          <button onClick={() => handleSellClick(item)} className="p-2 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-all active:scale-90 bg-slate-50 flex items-center justify-center" title="Record sale">
            <Minus size={16} />
          </button>
          <div className="min-w-[70px] text-center">
            <InlineQtyInput 
              key={`qty-down-single-${item.id}`}
              value={item.downOfficeQty || 0}
              onChange={(val) => handleSetOfficeQty(item, 'down', val)}
              className="w-16 text-center text-2xl font-black text-blue-600 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              isLastUpdated={isLastUpdated}
            />
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">In Down</p>
          </div>
          <button onClick={() => handlePurchaseClick(item, 'down')} className="p-2 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-all active:scale-90 bg-slate-50 flex items-center justify-center">
            <Plus size={16} />
          </button>
        </div>
      </td>
    )}

    {locationFilter === 'nagdevi' && (
      <td className="px-6 py-4 bg-blue-50/20 whitespace-nowrap">
        <div className="flex items-center gap-3 font-bold text-slate-900">
          <button onClick={() => handleSellClick(item)} className="p-2 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-all active:scale-90 bg-slate-50 flex items-center justify-center" title="Record sale">
            <Minus size={16} />
          </button>
          <div className="min-w-[70px] text-center">
            <InlineQtyInput 
              key={`qty-nagdevi-single-${item.id}`}
              value={item.nagdeviOfficeQty || 0}
              onChange={(val) => handleSetOfficeQty(item, 'nagdevi', val)}
              className="w-16 text-center text-2xl font-black text-blue-600 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              isLastUpdated={isLastUpdated}
            />
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">In Nagdevi</p>
          </div>
          <button onClick={() => handlePurchaseClick(item, 'nagdevi')} className="p-2 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-all active:scale-90 bg-slate-50 flex items-center justify-center">
            <Plus size={16} />
          </button>
        </div>
      </td>
    )}

    <td className="px-6 py-4 whitespace-nowrap text-right w-28 sticky right-0 z-20 border-l border-slate-200 bg-white/95 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => handleEditClick(item)}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
          title="Edit Name/Price"
        >
          <Pencil size={18} />
        </button>
        <button
          onClick={() => handleDeleteClick(item)}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
          title="Delete Item"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </td>
  </tr>
));

const MobileInventoryCard = React.memo(({ 
  item, 
  locationFilter, 
  handleUpdateOfficeQty, 
  handleSetOfficeQty,
  handleSetBoxPacking,
  handleSetPrice,
  handleEditClick, 
  handleDeleteClick,
  handleInsertBelowClick,
  handleSellClick,
  handlePurchaseClick,
  isEditing,
  isLastUpdated
}: { 
  item: InventoryItem; 
  locationFilter: 'all' | 'upper' | 'down' | 'nagdevi'; 
  handleUpdateOfficeQty: (item: InventoryItem, office: 'upper' | 'down' | 'nagdevi', delta: number) => void;
  handleSetOfficeQty: (item: InventoryItem, office: 'upper' | 'down' | 'nagdevi', value: number) => void;
  handleSetBoxPacking: (item: InventoryItem, value: string) => void;
  handleSetPrice: (item: InventoryItem, value: number) => void;
  handleEditClick: (item: InventoryItem) => void;
  handleDeleteClick: (item: InventoryItem) => void;
  handleInsertBelowClick: (item: InventoryItem) => void;
  handleSellClick: (item: InventoryItem) => void;
  handlePurchaseClick: (item: InventoryItem, office: SaleLocation) => void;
  isEditing?: boolean;
  isLastUpdated?: boolean;
}) => (
  <div
    className={`p-4 rounded-2xl border transition-colors duration-150 space-y-4 ${
      isEditing 
        ? "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/25 shadow-md" 
        : isLastUpdated 
        ? "bg-emerald-100/90 border-emerald-600 ring-4 ring-emerald-500/20 shadow-md" 
        : "bg-white border-slate-200 shadow-sm focus-within:bg-blue-50/70 focus-within:border-blue-400 focus-within:shadow-md"
    }`}
  >
    <div className="flex justify-between items-start gap-2">
      <div className="flex-1 border-r border-slate-100 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 tracking-wider shrink-0 border border-indigo-200/50">
              {item.category}
            </span>
          )}
          <h4 className="font-black text-slate-900 text-base leading-tight uppercase break-words">{item.name}</h4>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap animate-none">
          <InlinePriceInput key={`price-mobile-${item.id}`} value={item.price} onChange={(val) => handleSetPrice(item, val)} isLastUpdated={isLastUpdated} />
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">PACKING:</span>
            <BoxPackingInput key={`packing-mobile-${item.id}`} item={item} handleSetBoxPacking={handleSetBoxPacking} isLastUpdated={isLastUpdated} />
          </div>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => handleInsertBelowClick(item)}
          className="p-2 text-slate-400 hover:text-green-600 rounded-lg bg-slate-50"
          title="Insert New Item Below"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => handleSellClick(item)}
          className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg bg-slate-50"
          title="Record Sale"
        >
          <TrendingDown size={16} />
        </button>
        <button
          onClick={() => handleEditClick(item)}
          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg bg-slate-50"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => handleDeleteClick(item)}
          className="p-2 text-slate-400 hover:text-red-500 rounded-lg bg-slate-50"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>

    <div className="grid grid-cols-4 gap-1">
       <div className={`p-2 rounded-xl text-center ${locationFilter === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50'}`}>
        <p className={`text-[8px] uppercase font-bold ${locationFilter === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>Total</p>
        <p className="text-sm font-black">{item.quantity}</p>
      </div>
      <div className={`p-2 rounded-xl text-center ${locationFilter === 'upper' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50'}`}>
        <p className={`text-[8px] uppercase font-bold ${locationFilter === 'upper' ? 'text-blue-100' : 'text-slate-400'}`}>Upper</p>
        <p className="text-sm font-black">{item.upperOfficeQty || 0}</p>
      </div>
      <div className={`p-2 rounded-xl text-center ${locationFilter === 'down' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50'}`}>
        <p className={`text-[8px] uppercase font-bold ${locationFilter === 'down' ? 'text-blue-100' : 'text-slate-400'}`}>Down</p>
        <p className="text-sm font-black">{item.downOfficeQty || 0}</p>
      </div>
      <div className={`p-2 rounded-xl text-center ${locationFilter === 'nagdevi' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50'}`}>
        <p className={`text-[8px] uppercase font-bold ${locationFilter === 'nagdevi' ? 'text-blue-100' : 'text-slate-400'}`}>Nagdevi</p>
        <p className="text-sm font-black">{item.nagdeviOfficeQty || 0}</p>
      </div>
    </div>

    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
      <div className="flex-1">
        <p className="text-[10px] font-black text-slate-400 uppercase">Change {locationFilter === 'all' ? 'Upper Stock' : locationFilter}</p>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => handleSellClick(item)}
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm text-slate-600 active:scale-90 transition-transform"
          title="Record sale"
        >
          <Minus size={20} />
        </button>
        <InlineQtyInput 
          key={`qty-mobile-${item.id}-${locationFilter}`}
          value={
            locationFilter === 'all' ? (item.upperOfficeQty || 0) : 
            locationFilter === 'upper' ? (item.upperOfficeQty || 0) :
            locationFilter === 'down' ? (item.downOfficeQty || 0) :
            (item.nagdeviOfficeQty || 0)
          }
          onChange={(val) => {
            handleSetOfficeQty(
              item, 
              locationFilter === 'all' ? 'upper' : locationFilter, 
              val
            );
          }}
          className="w-14 text-center text-xl font-black text-blue-600 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          isLastUpdated={isLastUpdated}
        />
        <button 
          onClick={() => handlePurchaseClick(item, locationFilter === 'all' ? 'upper' : locationFilter)}
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm text-slate-600 active:scale-90 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  </div>
));

export const InventoryTable: React.FC<InventoryTableProps> = ({ items, setItems, locationFilter, onFilterChange }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const isMobile = useIsMobile();

  const [deleteModal, setDeleteModal] = React.useState<{ isOpen: boolean; item: InventoryItem | null }>({
    isOpen: false,
    item: null,
  });
  const [editModal, setEditModal] = React.useState<{ isOpen: boolean; item: InventoryItem | null }>({
    isOpen: false,
    item: null,
  });
  const [sellModal, setSellModal] = React.useState<{ isOpen: boolean; item: InventoryItem | null; preferredLocation: SaleLocation }>({
    isOpen: false,
    item: null,
    preferredLocation: 'upper',
  });
  const [purchaseModal, setPurchaseModal] = React.useState<{ isOpen: boolean; item: InventoryItem | null; preferredLocation: SaleLocation }>({
    isOpen: false,
    item: null,
    preferredLocation: 'upper',
  });
  const [insertModal, setInsertModal] = React.useState<{ isOpen: boolean; itemBelow: InventoryItem | null }>({
    isOpen: false,
    itemBelow: null,
  });
  const [statusState, setStatusState] = React.useState<{
    isOpen: boolean;
    type: StatusType;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const [activeDb, setActiveDb] = React.useState<DatabaseProvider>('firestore');

  React.useEffect(() => {
    return subscribeToDatabaseProvider(setActiveDb);
  }, []);

  const [updatedRowIds, setUpdatedRowIds] = React.useState<Record<string, number>>({});

  const triggerUpdateHighlight = useCallback((itemId: string) => {
    const now = Date.now();
    setUpdatedRowIds((prev) => ({ ...prev, [itemId]: now }));
    
    // Automatically clear after 4 seconds to stop the pulse/flash in a friendly manner
    setTimeout(() => {
      setUpdatedRowIds((prev) => {
        // Only clear if no newer update has occurred for this item
        if (prev[itemId] === now) {
          const next = { ...prev };
          delete next[itemId];
          return next;
        }
        return prev;
      });
    }, 4000);
  }, []);

  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '');
    const rawSearch = deferredSearchTerm.trim().toLowerCase();
    const searchQueryNormalized = normalizeSearchText(deferredSearchTerm.trim());
    // Split into individual search words for flexible matching (e.g. "MK 12 CAM GEAR" or "MK 12")
    const searchTokens = rawSearch.split(/\s+/).filter(Boolean);

    return items.filter(item => {
      const nameRaw = (item.name || '').toLowerCase();
      const catRaw = (item.category || '').toLowerCase();
      const nameNormalized = normalizeSearchText(item.name || '');
      const catNormalized = normalizeSearchText(item.category || '');
      const combinedText = `${catRaw} ${nameRaw}`;
      const combinedNormalized = `${catNormalized}${nameNormalized}`;

      // Check if search matches either continuous normalized string OR all individual space-separated words
      const matchesSearch = rawSearch === '' || 
        combinedNormalized.includes(searchQueryNormalized) ||
        searchTokens.every(token => combinedText.includes(token));

      const matchesCategory = 
        selectedCategory === 'all' || 
        (item.category && item.category.toUpperCase().trim() === selectedCategory);

      const matchesLocation = 
        locationFilter === 'all' ||
        (locationFilter === 'upper' && (item.upperOfficeQty || 0) > 0) ||
        (locationFilter === 'down' && (item.downOfficeQty || 0) > 0) ||
        (locationFilter === 'nagdevi' && (item.nagdeviOfficeQty || 0) > 0);

      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [items, deferredSearchTerm, locationFilter, selectedCategory]);

  const handleUpdateOfficeQty = useCallback(async (item: InventoryItem, office: 'upper' | 'down' | 'nagdevi', delta: number) => {
    const quantities = {
      upper: item.upperOfficeQty || 0,
      down: item.downOfficeQty || 0,
      nagdevi: item.nagdeviOfficeQty || 0,
    };

    if (office === 'upper') quantities.upper = Math.max(0, quantities.upper + delta);
    if (office === 'down') quantities.down = Math.max(0, quantities.down + delta);
    if (office === 'nagdevi') quantities.nagdevi = Math.max(0, quantities.nagdevi + delta);

    const total = quantities.upper + quantities.down + quantities.nagdevi;
    
    // Fast synchronous optimistic update
    if (setItems) {
      triggerUpdateHighlight(item.id);
      setItems((prev) => 
        prev.map(i => i.id === item.id ? {
          ...i,
          upperOfficeQty: quantities.upper,
          downOfficeQty: quantities.down,
          nagdeviOfficeQty: quantities.nagdevi,
          quantity: total,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
        } : i)
      );
    }

    try {
      await inventoryService.updateQuantity(item, {
        total,
        ...quantities
      });
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Stock Updated',
        message: `${item.name.toUpperCase()} quantity changed.`
      });
    } catch (error) {
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: 'Could not update stock units.'
      });
    }
  }, [setItems]);

  const handleSetOfficeQty = useCallback(async (item: InventoryItem, office: 'upper' | 'down' | 'nagdevi', value: number) => {
    const targetValue = Math.max(0, value);

    const quantities = {
      upper: item.upperOfficeQty || 0,
      down: item.downOfficeQty || 0,
      nagdevi: item.nagdeviOfficeQty || 0,
    };

    quantities[office] = targetValue;

    const total = quantities.upper + quantities.down + quantities.nagdevi;
    
    // Fast synchronous optimistic update
    if (setItems) {
      triggerUpdateHighlight(item.id);
      setItems((prev) => 
        prev.map(i => i.id === item.id ? {
          ...i,
          upperOfficeQty: quantities.upper,
          downOfficeQty: quantities.down,
          nagdeviOfficeQty: quantities.nagdevi,
          quantity: total,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
        } : i)
      );
    }

    try {
      await inventoryService.updateQuantity(item, {
        total,
        ...quantities
      });
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Stock Updated',
        message: `${item.name.toUpperCase()} quantity direct-changed.`
      });
    } catch (error) {
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: 'Could not update stock units.'
      });
    }
  }, [setItems]);

  const handleSetBoxPacking = useCallback(async (item: InventoryItem, value: string) => {
    const targetValue = value.toUpperCase().trim();

    // Fast synchronous optimistic update
    if (setItems) {
      triggerUpdateHighlight(item.id);
      setItems((prev) => 
        prev.map(i => i.id === item.id ? {
          ...i,
          boxPacking: targetValue,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
        } : i)
      );
    }

    try {
      await inventoryService.updateBoxPacking(item, targetValue);
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Packing Saved',
        message: `${item.name.toUpperCase()} packing updated.`
      });
    } catch (error) {
      // Revert if error occurs
      if (setItems) {
        setItems((prev) => 
          prev.map(i => i.id === item.id ? item : i)
        );
      }
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: 'Could not save box packing text.'
      });
    }
  }, [setItems]);

  const handleSetPrice = useCallback(async (item: InventoryItem, value: number) => {
    const targetValue = Math.max(0, value);

    // Fast synchronous optimistic update
    if (setItems) {
      triggerUpdateHighlight(item.id);
      setItems((prev) => 
        prev.map(i => i.id === item.id ? {
          ...i,
          price: targetValue,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
        } : i)
      );
    }

    try {
      await inventoryService.updateItem(item, {
        name: item.name,
        price: targetValue,
        boxPacking: item.boxPacking || ''
      });
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Price Saved',
        message: `${item.name.toUpperCase()} price updated.`
      });
    } catch (error) {
      // Revert if error occurs
      if (setItems) {
        setItems((prev) => 
          prev.map(i => i.id === item.id ? item : i)
        );
      }
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: 'Could not update item price.'
      });
    }
  }, [setItems]);

  const handleDeleteClick = useCallback((item: InventoryItem) => {
    setDeleteModal({ isOpen: true, item });
  }, []);

  const handleEditClick = useCallback((item: InventoryItem) => {
    setEditModal({ isOpen: true, item });
  }, []);

  const handleConfirmDelete = async () => {
    if (deleteModal.item) {
      const origItem = deleteModal.item;

      // Fast synchronous optimistic update
      if (setItems) {
        setItems((prev) => prev.filter(i => i.id !== origItem.id));
      }

      setDeleteModal({ isOpen: false, item: null });
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Removed',
        message: `${origItem.name.toUpperCase()} has been deleted.`
      });

      try {
        await inventoryService.deleteItem(origItem);
      } catch (error) {
        // Revert UI if error occurs
        if (setItems) {
          setItems((prev) => [...prev, origItem]);
        }
        setStatusState({
          isOpen: true,
          type: 'error',
          title: 'Delete Failed',
          message: 'Could not remove the item.'
        });
      }
    }
  };

  const handleConfirmEdit = async ({ name, price, boxPacking, category }: { name: string; price: number; boxPacking: string; category?: string }) => {
    if (editModal.item) {
      const origItem = editModal.item;
      const targetName = name.toUpperCase();
      const targetBoxPacking = boxPacking.toUpperCase().trim();
      const targetCategory = category ? category.toUpperCase().trim() : '';

      // Fast synchronous optimistic update
      if (setItems) {
        triggerUpdateHighlight(origItem.id);
        setItems((prev) => 
          prev.map(i => i.id === origItem.id ? {
            ...i,
            name: targetName,
            price: price,
            boxPacking: targetBoxPacking,
            category: targetCategory,
            updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
          } : i)
        );
      }

      setEditModal({ isOpen: false, item: null });
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Changes Saved',
        message: `Updated ${targetName} successfully.`
      });

      try {
        await inventoryService.updateItem(origItem, { 
          name: targetName, 
          price, 
          boxPacking: targetBoxPacking,
          category: targetCategory 
        });
      } catch (error) {
        // Revert UI if error occurs
        if (setItems) {
          setItems((prev) => 
            prev.map(i => i.id === origItem.id ? origItem : i)
          );
        }
        setStatusState({
          isOpen: true,
          type: 'error',
          title: 'Update Failed',
          message: 'Could not save the changes.'
        });
      }
    }
  };

  const handleInsertBelowClick = useCallback((item: InventoryItem) => {
    setInsertModal({ isOpen: true, itemBelow: item });
  }, []);

  const handleSellClick = useCallback((item: InventoryItem) => {
    setSellModal({
      isOpen: true,
      item,
      preferredLocation: locationFilter === 'all' ? 'upper' : locationFilter,
    });
  }, [locationFilter]);

  const handlePurchaseClick = useCallback((item: InventoryItem, office: SaleLocation) => {
    setPurchaseModal({
      isOpen: true,
      item,
      preferredLocation: office,
    });
  }, []);

  const handleConfirmSale = async (sale: {
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
  }) => {
    const item = items.find(i => i.id === sale.itemId);
    if (!item) return;

    const targetQty = sale.quantity;
    const availableQty = sale.location === 'upper'
      ? item.upperOfficeQty || 0
      : sale.location === 'down'
        ? item.downOfficeQty || 0
        : item.nagdeviOfficeQty || 0;

    if (targetQty > availableQty) {
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Not Enough Stock',
        message: `${item.name.toUpperCase()} only has ${availableQty} units in ${sale.location.toUpperCase()} stock.`
      });
      return;
    }

    const nextQty = {
      upper: item.upperOfficeQty || 0,
      down: item.downOfficeQty || 0,
      nagdevi: item.nagdeviOfficeQty || 0,
    };

    if (sale.location === 'upper') nextQty.upper = Math.max(0, nextQty.upper - targetQty);
    if (sale.location === 'down') nextQty.down = Math.max(0, nextQty.down - targetQty);
    if (sale.location === 'nagdevi') nextQty.nagdevi = Math.max(0, nextQty.nagdevi - targetQty);

    const total = nextQty.upper + nextQty.down + nextQty.nagdevi;

    if (setItems) {
      setItems((prev) => prev.map(i => i.id === item.id ? {
        ...i,
        upperOfficeQty: nextQty.upper,
        downOfficeQty: nextQty.down,
        nagdeviOfficeQty: nextQty.nagdevi,
        quantity: total,
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
      } : i));
    }

    setSellModal({ isOpen: false, item: null, preferredLocation: 'upper' });
    setStatusState({
      isOpen: true,
      type: 'success',
      title: 'Sale Recorded',
      message: `${sale.quantity} ${item.name.toUpperCase()} sold to ${sale.companyName.toUpperCase()} on ${sale.soldAt.toLocaleDateString('en-GB')}.`
    });

    try {
      await inventoryService.recordSale(item, {
        customerName: sale.customerName,
        companyName: sale.companyName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        location: sale.location,
        soldAt: sale.soldAt,
        notes: sale.notes,
      });
    } catch (error) {
      if (setItems) {
        setItems((prev) => prev.map(i => i.id === item.id ? item : i));
      }
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Sale Failed',
        message: 'Could not save the sale record.'
      });
    }
  };

  const handleConfirmPurchase = async (purchase: {
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
  }) => {
    const item = items.find(i => i.id === purchase.itemId);
    if (!item) return;

    const nextQty = {
      upper: item.upperOfficeQty || 0,
      down: item.downOfficeQty || 0,
      nagdevi: item.nagdeviOfficeQty || 0,
    };

    if (purchase.location === 'upper') nextQty.upper += purchase.quantity;
    if (purchase.location === 'down') nextQty.down += purchase.quantity;
    if (purchase.location === 'nagdevi') nextQty.nagdevi += purchase.quantity;

    const total = nextQty.upper + nextQty.down + nextQty.nagdevi;

    if (setItems) {
      setItems((prev) => prev.map(i => i.id === item.id ? {
        ...i,
        price: purchase.unitPrice > 0 ? purchase.unitPrice : i.price,
        boxPacking: purchase.boxPacking || i.boxPacking,
        upperOfficeQty: nextQty.upper,
        downOfficeQty: nextQty.down,
        nagdeviOfficeQty: nextQty.nagdevi,
        quantity: total,
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
      } : i));
    }

    setPurchaseModal({ isOpen: false, item: null, preferredLocation: 'upper' });
    setStatusState({
      isOpen: true,
      type: 'success',
      title: 'Purchase Recorded',
      message: `${purchase.quantity} units of ${item.name.toUpperCase()} added to ${purchase.location.toUpperCase()} stock.`
    });

    try {
      await inventoryService.recordPurchase(item, {
        supplierName: purchase.supplierName,
        boxPacking: purchase.boxPacking,
        quantity: purchase.quantity,
        unitPrice: purchase.unitPrice,
        location: purchase.location,
        purchasedAt: purchase.purchasedAt,
        notes: purchase.notes,
      });
    } catch (error) {
      if (setItems) {
        setItems((prev) => prev.map(i => i.id === item.id ? item : i));
      }
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Purchase Failed',
        message: 'Could not save the purchase record.'
      });
    }
  };

  const handleConfirmInsertBelow = async (values: {
    name: string;
    price: number;
    boxPacking: string;
    category?: string;
    upper: number;
    down: number;
    nagdevi: number;
  }) => {
    if (insertModal.itemBelow) {
      const itemBelow = insertModal.itemBelow;
      const targetName = values.name.toUpperCase();
      const targetBoxPacking = values.boxPacking.toUpperCase().trim();
      const targetCategory = values.category ? values.category.toUpperCase().trim() : undefined;
      const upper = values.upper;
      const down = values.down;
      const nagdevi = values.nagdevi;
      const price = values.price;

      // 1. Find the item below's position in our currently sorted items
      const currentIndex = items.findIndex(i => i.id === itemBelow.id);
      
      let calculatedOrderIndex = Date.now();
      if (currentIndex !== -1) {
        const currentItem = items[currentIndex];
        // Find next item in the full items list that is currently loaded
        const nextItem = items[currentIndex + 1];
        if (nextItem) {
          calculatedOrderIndex = ((currentItem.orderIndex ?? Date.now()) + (nextItem.orderIndex ?? Date.now())) / 2;
        } else {
          calculatedOrderIndex = (currentItem.orderIndex ?? Date.now()) + 1000;
        }
      }

      // 2. Generate optimistic item
      const tempId = `temp-${Date.now()}`;
      const optimisticItem: InventoryItem = {
        id: tempId,
        name: targetName,
        price,
        quantity: upper + down + nagdevi,
        upperOfficeQty: upper,
        downOfficeQty: down,
        nagdeviOfficeQty: nagdevi,
        boxPacking: targetBoxPacking || undefined,
        category: targetCategory,
        ownerId: itemBelow.ownerId || '',
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
        orderIndex: calculatedOrderIndex,
      };

      // 3. Update the state with the optimistic item in the correct position!
      if (setItems) {
        setItems((prev) => {
          if (prev.some(i => i.name === targetName)) return prev;
          const nextItems = [...prev, optimisticItem];
          // Sort items
          return nextItems.sort((a, b) => {
            const orderA = a.orderIndex !== undefined ? a.orderIndex : 0;
            const orderB = b.orderIndex !== undefined ? b.orderIndex : 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          });
        });
        
        // Flash the inserted item
        triggerUpdateHighlight(tempId);
      }

      setInsertModal({ isOpen: false, itemBelow: null });
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Inserted',
        message: `${targetName} has been inserted successfully.`
      });

      // 4. Send request to database
      try {
        await inventoryService.addItem({
          name: targetName,
          price,
          quantity: upper + down + nagdevi,
          upperOfficeQty: upper,
          downOfficeQty: down,
          nagdeviOfficeQty: nagdevi,
          boxPacking: targetBoxPacking || undefined,
          category: targetCategory,
          orderIndex: calculatedOrderIndex
        }, items);
      } catch (error) {
        // Revert from UI if error
        if (setItems) {
          setItems((prev) => prev.filter(i => i.id !== tempId));
        }
        setStatusState({
          isOpen: true,
          type: 'error',
          title: 'Insert Failed',
          message: 'Could not insert the item.'
        });
      }
    }
  };

  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  // 1. Export strictly in the exact UI sequence (filteredItems is already sorted by orderIndex / name)
  const handleExportExcel = useCallback(() => {
    try {
      setIsExporting(true);
      const rows = filteredItems.map((item, index) => ({
        "Sr No": index + 1,
        "Category / Model": item.category || "",
        "Item Name": item.name,
        "Price (₹)": item.price,
        "Box Packing": item.boxPacking || "",
        "Total Qty": item.quantity,
        "Upper Office Qty": item.upperOfficeQty || 0,
        "Down Office Qty": item.downOfficeQty || 0,
        "Nagdevi Office Qty": item.nagdeviOfficeQty || 0,
        "Last Updated": item.updatedAt?.seconds 
          ? new Date(item.updatedAt.seconds * 1000).toLocaleDateString('en-GB') 
          : "27/07/2026"
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 20 },
        { wch: 35 },
        { wch: 12 },
        { wch: 16 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 15 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Inventory');
      const now = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Vardhaman_Stock_${now}.xlsx`);

      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Excel Exported',
        message: `Exported ${filteredItems.length} items in exact screen sequence.`
      });
    } catch (error) {
      console.error('Excel export error:', error);
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Export Failed',
        message: 'Could not generate Excel file.'
      });
    } finally {
      setIsExporting(false);
    }
  }, [filteredItems]);

  // 2. Dual Backup: Download full JSON file AND clone to a new Firestore collection
  const handleBackupData = useCallback(async () => {
    try {
      setIsBackingUp(true);
      // a) Download full JSON file locally (Always works, unaffected by Firestore rules)
      const jsonStats = await inventoryService.exportAllDataToJSON();
      
      // b) Attempt to clone to Firestore backup collection
      let firestoreMessage = '';
      try {
        const firestoreStats = await inventoryService.backupAllDataToFirestoreCollection();
        firestoreMessage = ` and ${firestoreStats.count} records cloned to Firestore collection '${firestoreStats.targetCollection}'`;
      } catch (fsErr) {
        console.warn('Firestore cloud backup collection write failed (likely rule restriction):', fsErr);
        firestoreMessage = ` (Offline JSON backup file downloaded successfully).`;
      }

      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Backup Successful',
        message: `Backed up ${jsonStats.counts.inventory} items: Full database JSON file downloaded to your device${firestoreMessage}`
      });
    } catch (error) {
      console.error('Backup error:', error);
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Backup Failed',
        message: 'Could not export database backup file.'
      });
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input with Category support */}
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search by Item Name or Category (e.g. MK-12, VILLIERS)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium uppercase placeholder:normal-case"
            />
          </div>

          {/* Category Dropdown Filter */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs font-black uppercase text-slate-700 outline-none cursor-pointer pr-2"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Location Tabs */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            {(['all', 'upper', 'down', 'nagdevi'] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => onFilterChange(loc)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all capitalize ${
                  locationFilter === loc 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {loc === 'all' ? 'All Stock' : loc}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Toolbar: Counts + Action Buttons (Export to Excel & Dual Backup) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 px-1">
            <span>Showing <strong className="text-slate-900">{filteredItems.length}</strong> of {items.length} items</span>
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory('all')} className="hover:text-indigo-900 ml-1">✕</button>
              </span>
            )}
            {/* Live Database Source Indicator */}
            <span 
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                activeDb === 'supabase'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
              title={activeDb === 'supabase' ? 'Reading live from Supabase (Unlimited)' : 'Reading live from Firestore'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeDb === 'supabase' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
              Database: {activeDb === 'supabase' ? 'Supabase (Unlimited)' : 'Firestore'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export to Excel (Sequence Guaranteed) */}
            <button
              onClick={handleExportExcel}
              disabled={isExporting || filteredItems.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export all items currently displayed in exact sequence to Excel"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              <span>Export Excel</span>
            </button>

            {/* Dual Backup Button (JSON File + Firestore Collection) */}
            <button
              onClick={handleBackupData}
              disabled={isBackingUp}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download full JSON backup and clone database into a backup collection in Firestore"
            >
              {isBackingUp ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              <span>Backup Data</span>
            </button>
          </div>
        </div>
      </div>

      {!isMobile ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
          {isProcessing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="bg-white px-6 py-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3">
                <Loader2 className="animate-spin text-blue-600" size={24} />
                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Processing...</span>
              </div>
            </div>
          )}
          <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[350px] relative">
            <table className="w-full text-left min-w-[1140px] border-collapse table-fixed">
              <thead className="bg-slate-50 text-left sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.02)] border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 top-0 bg-slate-50 z-40 shadow-sm border-r border-slate-200 w-[380px] min-w-[320px]">Item Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-30 shadow-sm w-[120px]">Price</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-30 shadow-sm w-[140px]">Box Packing</th>
                  
                  {locationFilter === 'all' && (
                    <>
                      <th className="px-6 py-4 text-xs font-semibold text-blue-600 bg-blue-50/95 uppercase tracking-wider sticky top-0 z-30 shadow-sm w-[140px]">Total Stock</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-30 shadow-sm w-[170px]">Upper Office</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-30 shadow-sm w-[170px]">Down Office</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 z-30 shadow-sm w-[170px]">Nagdevi</th>
                    </>
                  )}

                  {locationFilter === 'upper' && (
                    <th className="px-6 py-4 text-xs font-semibold text-blue-600 bg-blue-50/95 uppercase tracking-wider sticky top-0 z-30 shadow-sm w-[220px]">Upper Office Stock</th>
                  )}

                  {locationFilter === 'down' && (
                    <th className="px-6 py-4 text-xs font-semibold text-blue-600 bg-blue-50/95 uppercase tracking-wider sticky top-0 z-30 shadow-sm w-[220px]">Down Office Stock</th>
                  )}

                  {locationFilter === 'nagdevi' && (
                    <th className="px-6 py-4 text-xs font-semibold text-blue-600 bg-blue-50/95 uppercase tracking-wider sticky top-0 z-30 shadow-sm w-[220px]">Nagdevi Office Stock</th>
                  )}

                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right sticky right-0 top-0 bg-slate-50 z-40 shadow-[2px_0_0_rgba(148,163,184,0.1)] border-l border-slate-200 w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 uppercase">
                {filteredItems.map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    locationFilter={locationFilter}
                    handleUpdateOfficeQty={handleUpdateOfficeQty}
                    handleSetOfficeQty={handleSetOfficeQty}
                    handleSetBoxPacking={handleSetBoxPacking}
                    handleSetPrice={handleSetPrice}
                    handleEditClick={handleEditClick}
                    handleDeleteClick={handleDeleteClick}
                    handleInsertBelowClick={handleInsertBelowClick}
                    handleSellClick={handleSellClick}
                    handlePurchaseClick={handlePurchaseClick}
                    isEditing={editModal.isOpen && editModal.item?.id === item.id}
                    isLastUpdated={!!updatedRowIds[item.id]}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={locationFilter === 'all' ? 8 : 5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <PackageSearch size={48} strokeWidth={1} />
                        <div>
                          <p className="font-medium text-slate-600 uppercase tracking-wider text-xs">No items found</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <MobileInventoryCard
              key={item.id}
              item={item}
              locationFilter={locationFilter}
              handleUpdateOfficeQty={handleUpdateOfficeQty}
              handleSetOfficeQty={handleSetOfficeQty}
              handleSetBoxPacking={handleSetBoxPacking}
              handleSetPrice={handleSetPrice}
              handleEditClick={handleEditClick}
              handleDeleteClick={handleDeleteClick}
              handleInsertBelowClick={handleInsertBelowClick}
              handleSellClick={handleSellClick}
              handlePurchaseClick={handlePurchaseClick}
              isEditing={editModal.isOpen && editModal.item?.id === item.id}
              isLastUpdated={!!updatedRowIds[item.id]}
            />
          ))}
          {filteredItems.length === 0 && (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
               <PackageSearch size={48} className="mx-auto text-slate-300 mb-2" strokeWidth={1} />
               <p className="font-medium text-slate-500 uppercase tracking-wider text-xs">No items found</p>
            </div>
          )}
        </div>
      )}
      
      <DeleteModal
        isOpen={deleteModal.isOpen}
        itemName={deleteModal.item?.name || ''}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        onConfirm={handleConfirmDelete}
      />

      <EditItemModal
        isOpen={editModal.isOpen}
        item={editModal.item}
        onClose={() => setEditModal({ isOpen: false, item: null })}
        onConfirm={handleConfirmEdit}
      />

      <InsertItemModal
        isOpen={insertModal.isOpen}
        itemBelow={insertModal.itemBelow}
        onClose={() => setInsertModal({ isOpen: false, itemBelow: null })}
        onConfirm={handleConfirmInsertBelow}
      />

      <SellItemModal
        isOpen={sellModal.isOpen}
        item={sellModal.item}
        preferredLocation={sellModal.preferredLocation}
        onClose={() => setSellModal({ isOpen: false, item: null, preferredLocation: 'upper' })}
        onConfirm={handleConfirmSale}
      />

      <PurchaseItemModal
        isOpen={purchaseModal.isOpen}
        item={purchaseModal.item}
        preferredLocation={purchaseModal.preferredLocation}
        onClose={() => setPurchaseModal({ isOpen: false, item: null, preferredLocation: 'upper' })}
        onConfirm={handleConfirmPurchase}
      />

      <StatusModal
        isOpen={statusState.isOpen}
        onClose={() => setStatusState({ ...statusState, isOpen: false })}
        type={statusState.type}
        title={statusState.title}
        message={statusState.message}
      />
    </div>
  );
};
