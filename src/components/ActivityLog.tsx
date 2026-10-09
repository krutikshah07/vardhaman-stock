import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuditLog, AuditAction } from '../types';
import { inventoryService } from '../services/inventoryService';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  X, 
  User, 
  ArrowRight, 
  ArrowDownRight, 
  ArrowUpRight, 
  Plus, 
  Edit, 
  Trash2, 
  PackageCheck, 
  Upload, 
  Trash, 
  Download, 
  RefreshCw, 
  ShoppingCart, 
  Truck, 
  Tag, 
  ChevronLeft, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';

type DateFilterType = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type ActionFilterType = 'ALL' | 'SALE' | 'PURCHASE' | 'STOCK_ADJUST' | 'UPDATE' | 'CREATE_DELETE';

// Helper to format Firestore timestamp or Date to readable format
const formatLogDateTime = (timestamp: any) => {
  if (!timestamp) return { full: 'Just now', time: '', relative: 'Just now' };

  let date: Date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    return { full: 'Recent', time: '', relative: 'Recent' };
  }

  if (isNaN(date.getTime())) {
    return { full: 'Recent', time: '', relative: 'Recent' };
  }

  // Format: 09 Oct 2026, 03:45 PM
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const formattedHours = String(hours).padStart(2, '0');

  const full = `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
  const dateOnly = `${day} ${month} ${year}`;
  const timeOnly = `${formattedHours}:${minutes} ${ampm}`;

  // Relative time
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let relative = 'Just now';
  if (diffDay > 30) {
    relative = `${dateOnly}`;
  } else if (diffDay > 1) {
    relative = `${diffDay} days ago`;
  } else if (diffDay === 1) {
    relative = 'Yesterday';
  } else if (diffHour >= 1) {
    relative = `${diffHour}h ago`;
  } else if (diffMin >= 1) {
    relative = `${diffMin}m ago`;
  }

  return { full, dateOnly, timeOnly, relative };
};

// Detailed diff card component
const AuditLogCard: React.FC<{ log: AuditLog }> = React.memo(({ log }) => {
  const dt = formatLogDateTime(log.timestamp);
  const changes = log.changes;
  const before = changes?.before;
  const after = changes?.after;

  // Extract structured details based on action type
  const isSale = log.action === 'SALE';
  const isPurchase = log.action === 'PURCHASE';
  const isStockAdjust = log.action === 'STOCK_ADJUST';
  const isUpdate = log.action === 'UPDATE';
  const isCreate = log.action === 'CREATE';
  const isDelete = log.action === 'DELETE';
  const isBatch = log.action === 'BATCH_IMPORT' || log.action === 'BATCH_DELETE';

  // Badges & styling per action
  const getBadgeConfig = () => {
    switch (log.action) {
      case 'SALE':
        return {
          title: 'Stock Sale',
          bgColor: 'bg-red-50 text-red-700 border-red-200',
          accentBorder: 'border-l-4 border-l-red-500',
          icon: <ShoppingCart size={15} className="text-red-600" />
        };
      case 'PURCHASE':
        return {
          title: 'Stock Purchase',
          bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accentBorder: 'border-l-4 border-l-emerald-500',
          icon: <Truck size={15} className="text-emerald-600" />
        };
      case 'STOCK_ADJUST':
        return {
          title: 'Manual Stock Correction',
          bgColor: 'bg-purple-50 text-purple-700 border-purple-200',
          accentBorder: 'border-l-4 border-l-purple-500',
          icon: <PackageCheck size={15} className="text-purple-600" />
        };
      case 'UPDATE':
        return {
          title: 'Item Details / Price Edited',
          bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
          accentBorder: 'border-l-4 border-l-blue-500',
          icon: <Edit size={15} className="text-blue-600" />
        };
      case 'CREATE':
        return {
          title: 'New Item Created',
          bgColor: 'bg-teal-50 text-teal-700 border-teal-200',
          accentBorder: 'border-l-4 border-l-teal-500',
          icon: <Plus size={15} className="text-teal-600" />
        };
      case 'DELETE':
        return {
          title: 'Item Deleted',
          bgColor: 'bg-rose-50 text-rose-700 border-rose-200',
          accentBorder: 'border-l-4 border-l-rose-500',
          icon: <Trash2 size={15} className="text-rose-600" />
        };
      case 'BATCH_IMPORT':
        return {
          title: 'Excel / CSV Import',
          bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accentBorder: 'border-l-4 border-l-emerald-500',
          icon: <Upload size={15} className="text-emerald-600" />
        };
      case 'BATCH_DELETE':
        return {
          title: 'Batch Delete All',
          bgColor: 'bg-red-50 text-red-700 border-red-200',
          accentBorder: 'border-l-4 border-l-red-500',
          icon: <Trash size={15} className="text-red-600" />
        };
      default:
        return {
          title: log.action,
          bgColor: 'bg-slate-50 text-slate-700 border-slate-200',
          accentBorder: 'border-l-4 border-l-slate-400',
          icon: <History size={15} className="text-slate-600" />
        };
    }
  };

  const badge = getBadgeConfig();

  // Extract Sale details
  const saleInfo = isSale && after?.sale ? after.sale : null;
  // Extract Purchase details
  const purchaseInfo = isPurchase && after?.purchase ? after.purchase : null;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-5 ${badge.accentBorder} space-y-4`}>
      {/* Header Row: Action badge, Item Name, Performer, and Timestamp */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${badge.bgColor}`}>
            {badge.icon}
            {badge.title}
          </span>

          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
            {log.itemName}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* User badge */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200">
            <User size={13} className="text-slate-500" />
            <span className="uppercase">{log.performedBy || 'ADMIN'}</span>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-1.5 bg-slate-50 text-slate-600 font-semibold px-3 py-1 rounded-lg border border-slate-200">
            <Calendar size={13} className="text-slate-400" />
            <span>{dt.full}</span>
            <span className="text-slate-400 font-normal">({dt.relative})</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: High-clarity before/after view for Dad */}
      {/* 1. SALE VIEW */}
      {isSale && (
        <div className="bg-red-50/40 border border-red-100 rounded-xl p-4 space-y-3">
          {saleInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-red-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Customer</span>
                <span className="font-bold text-slate-900 uppercase truncate block mt-0.5">
                  {saleInfo.customerName || 'N/A'}
                  {saleInfo.companyName ? ` (${saleInfo.companyName})` : ''}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-red-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Sold Quantity</span>
                <span className="font-black text-red-600 text-sm flex items-center gap-1 mt-0.5">
                  <TrendingDown size={14} />
                  -{saleInfo.quantity} units
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-red-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Sold From</span>
                <span className="font-bold text-slate-800 uppercase block mt-0.5">
                  {saleInfo.location === 'upper' ? 'Upper Office' : saleInfo.location === 'down' ? 'Down Office' : 'Nagdevi Office'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-red-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Rate & Total</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  ₹{saleInfo.unitPrice} <span className="text-slate-400 font-normal">| ₹{saleInfo.totalAmount}</span>
                </span>
              </div>
            </div>
          )}

          {/* Stock Transition */}
          {before && after && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-red-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase text-slate-500">Total Stock Impact:</span>
                <span className="font-bold text-slate-500 line-through">{before.total ?? 0}</span>
                <ArrowRight size={13} className="text-red-500" />
                <span className="font-black text-slate-900">{after.total ?? 0} units</span>
                <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-md">
                  ({(after.total ?? 0) - (before.total ?? 0)} units)
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium">
                <span>Upper: <b>{before.upper}</b> → <b>{after.upper}</b></span>
                <span>Down: <b>{before.down}</b> → <b>{after.down}</b></span>
                <span>Nagdevi: <b>{before.nagdevi}</b> → <b>{after.nagdevi}</b></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PURCHASE VIEW */}
      {isPurchase && (
        <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 space-y-3">
          {purchaseInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Supplier</span>
                <span className="font-bold text-slate-900 uppercase truncate block mt-0.5">
                  {purchaseInfo.supplierName || 'N/A'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Added Quantity</span>
                <span className="font-black text-emerald-600 text-sm flex items-center gap-1 mt-0.5">
                  <TrendingUp size={14} />
                  +{purchaseInfo.quantity} units
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Delivered To</span>
                <span className="font-bold text-slate-800 uppercase block mt-0.5">
                  {purchaseInfo.location === 'upper' ? 'Upper Office' : purchaseInfo.location === 'down' ? 'Down Office' : 'Nagdevi Office'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Purchase Rate</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  ₹{purchaseInfo.unitPrice} <span className="text-slate-400 font-normal">| ₹{purchaseInfo.totalAmount}</span>
                </span>
              </div>
            </div>
          )}

          {/* Stock Transition */}
          {before && after && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase text-slate-500">Total Stock Impact:</span>
                <span className="font-bold text-slate-500 line-through">{before.total ?? 0}</span>
                <ArrowRight size={13} className="text-emerald-500" />
                <span className="font-black text-slate-900">{after.total ?? 0} units</span>
                <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">
                  (+{(after.total ?? 0) - (before.total ?? 0)} units)
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium">
                <span>Upper: <b>{before.upper}</b> → <b>{after.upper}</b></span>
                <span>Down: <b>{before.down}</b> → <b>{after.down}</b></span>
                <span>Nagdevi: <b>{before.nagdevi}</b> → <b>{after.nagdevi}</b></span>
                {before.price !== after.price && (
                  <span className="text-emerald-700 font-bold bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    Price Updated: ₹{before.price} → ₹{after.price}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. STOCK ADJUSTMENT VIEW (Manual Correction) */}
      {isStockAdjust && before && after && (
        <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase text-slate-500">Overall Stock Change:</span>
              <span className="font-bold text-slate-500 text-sm line-through">{before.total ?? 0}</span>
              <ArrowRight size={14} className="text-purple-600" />
              <span className="font-black text-slate-900 text-sm">{after.total ?? 0} units</span>
              {typeof before.total === 'number' && typeof after.total === 'number' && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  after.total > before.total ? 'bg-emerald-100 text-emerald-700' :
                  after.total < before.total ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {after.total > before.total ? `+${after.total - before.total}` : `${after.total - before.total}`} units
                </span>
              )}
            </div>

            <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Direct Manual Count Update
            </span>
          </div>

          {/* Location breakdown boxes */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-purple-100 text-xs">
            <div className={`p-2.5 rounded-lg border ${before.upper !== after.upper ? 'bg-purple-100/50 border-purple-200' : 'bg-white border-slate-200'}`}>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Upper Office</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-slate-600">{before.upper ?? 0}</span>
                <ArrowRight size={12} className="text-slate-400" />
                <span className="font-black text-slate-900">{after.upper ?? 0}</span>
                {before.upper !== after.upper && (
                  <span className={`text-[10px] font-black ml-auto ${after.upper > before.upper ? 'text-emerald-600' : 'text-red-600'}`}>
                    ({after.upper - before.upper > 0 ? `+${after.upper - before.upper}` : after.upper - before.upper})
                  </span>
                )}
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border ${before.down !== after.down ? 'bg-purple-100/50 border-purple-200' : 'bg-white border-slate-200'}`}>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Down Office</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-slate-600">{before.down ?? 0}</span>
                <ArrowRight size={12} className="text-slate-400" />
                <span className="font-black text-slate-900">{after.down ?? 0}</span>
                {before.down !== after.down && (
                  <span className={`text-[10px] font-black ml-auto ${after.down > before.down ? 'text-emerald-600' : 'text-red-600'}`}>
                    ({after.down - before.down > 0 ? `+${after.down - before.down}` : after.down - before.down})
                  </span>
                )}
              </div>
            </div>

            <div className={`p-2.5 rounded-lg border ${before.nagdevi !== after.nagdevi ? 'bg-purple-100/50 border-purple-200' : 'bg-white border-slate-200'}`}>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Nagdevi Office</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-slate-600">{before.nagdevi ?? 0}</span>
                <ArrowRight size={12} className="text-slate-400" />
                <span className="font-black text-slate-900">{after.nagdevi ?? 0}</span>
                {before.nagdevi !== after.nagdevi && (
                  <span className={`text-[10px] font-black ml-auto ${after.nagdevi > before.nagdevi ? 'text-emerald-600' : 'text-red-600'}`}>
                    ({after.nagdevi - before.nagdevi > 0 ? `+${after.nagdevi - before.nagdevi}` : after.nagdevi - before.nagdevi})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DETAILS / PRICE UPDATE VIEW */}
      {isUpdate && (
        <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 space-y-2 text-xs">
          {typeof after === 'string' ? (
            <div className="font-medium text-slate-700">{after}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {before?.price !== undefined && after?.price !== undefined && before.price !== after.price && (
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Price Modification</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-bold">
                    <span className="text-slate-500 line-through">₹{before.price}</span>
                    <ArrowRight size={12} className="text-blue-500" />
                    <span className="text-blue-700 font-black">₹{after.price}</span>
                  </div>
                </div>
              )}

              {before?.name !== undefined && after?.name !== undefined && before.name !== after.name && (
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Item Name Changed</span>
                  <div className="mt-0.5 text-[11px]">
                    <span className="text-slate-500 line-through">{before.name}</span>
                    <ArrowRight size={11} className="inline mx-1 text-blue-500" />
                    <span className="text-slate-900 font-bold">{after.name}</span>
                  </div>
                </div>
              )}

              {before?.boxPacking !== undefined && after?.boxPacking !== undefined && before.boxPacking !== after.boxPacking && (
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Box Packing</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-bold">
                    <span className="text-slate-500">{before.boxPacking || 'None'}</span>
                    <ArrowRight size={12} className="text-blue-500" />
                    <span className="text-blue-700 font-black">{after.boxPacking || 'None'}</span>
                  </div>
                </div>
              )}

              {before?.category !== undefined && after?.category !== undefined && before.category !== after.category && (
                <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Category</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-bold">
                    <span className="text-slate-500">{before.category || 'None'}</span>
                    <ArrowRight size={12} className="text-blue-500" />
                    <span className="text-blue-700 font-black">{after.category || 'None'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. CREATE VIEW */}
      {isCreate && after && (
        <div className="bg-teal-50/40 border border-teal-100 rounded-xl p-3.5 text-xs flex flex-wrap items-center gap-4 text-slate-700">
          <span className="font-bold text-teal-800">Initial Stock Setup:</span>
          <span>Total: <b>{after.quantity ?? 0} units</b></span>
          <span>Upper: <b>{after.upperOfficeQty ?? 0}</b></span>
          <span>Down: <b>{after.downOfficeQty ?? 0}</b></span>
          <span>Nagdevi: <b>{after.nagdeviOfficeQty ?? 0}</b></span>
          {after.price > 0 && <span>Price: <b>₹{after.price}</b></span>}
          {after.boxPacking && <span>Packing: <b>{after.boxPacking}</b></span>}
        </div>
      )}

      {/* 6. DELETE VIEW */}
      {isDelete && (
        <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-700 font-medium">
          Item permanently removed from system
          {before?.quantity !== undefined && ` (Last recorded stock was ${before.quantity} units)`}
        </div>
      )}

      {/* 7. BATCH OPERATIONS VIEW */}
      {isBatch && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 font-medium">
          {typeof after === 'string' ? after : typeof before === 'string' ? before : 'Batch operation completed'}
        </div>
      )}
    </div>
  );
});

export const ActivityFeed: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilterType>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Real-time synchronization
  useEffect(() => {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const now = new Date();
    if (dateFilter === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateFilter === 'yesterday') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
    } else if (dateFilter === '7d') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
    } else if (dateFilter === '30d') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 30);
    } else if (dateFilter === 'custom') {
      if (customRange.start) startDate = new Date(customRange.start);
      if (customRange.end) {
        endDate = new Date(customRange.end);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    let isMounted = true;
    setIsLoading(true);

    inventoryService.fetchAuditLogsOnce(startDate, endDate, 250)
      .then((freshLogs) => {
        if (isMounted) {
          setLogs(freshLogs);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load audit logs:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [dateFilter, customRange]);

  // Manual refresh trigger
  const handleRefresh = async () => {
    setIsLoading(true);
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const now = new Date();

    if (dateFilter === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateFilter === 'yesterday') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
    } else if (dateFilter === '7d') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
    } else if (dateFilter === '30d') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 30);
    } else if (dateFilter === 'custom') {
      if (customRange.start) startDate = new Date(customRange.start);
      if (customRange.end) {
        endDate = new Date(customRange.end);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const nextLogs = await inventoryService.fetchAuditLogsOnce(startDate, endDate, 500);
    setLogs(nextLogs);
    setIsLoading(false);
  };

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Action Filter
      if (actionFilter === 'SALE' && log.action !== 'SALE') return false;
      if (actionFilter === 'PURCHASE' && log.action !== 'PURCHASE') return false;
      if (actionFilter === 'STOCK_ADJUST' && log.action !== 'STOCK_ADJUST') return false;
      if (actionFilter === 'UPDATE' && log.action !== 'UPDATE') return false;
      if (actionFilter === 'CREATE_DELETE' && !['CREATE', 'DELETE', 'BATCH_IMPORT', 'BATCH_DELETE'].includes(log.action)) return false;

      // 2. Search Query (checks Item Name, Customer Name, Supplier Name, Performer)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const itemNameMatch = log.itemName?.toLowerCase().includes(q);
        const performedByMatch = log.performedBy?.toLowerCase().includes(q);
        const emailMatch = log.performedByEmail?.toLowerCase().includes(q);

        const customerMatch = log.changes?.after?.sale?.customerName?.toLowerCase().includes(q) ||
          log.changes?.after?.sale?.companyName?.toLowerCase().includes(q);
        const supplierMatch = log.changes?.after?.purchase?.supplierName?.toLowerCase().includes(q);

        const rawStringMatch = typeof log.changes?.after === 'string' && log.changes.after.toLowerCase().includes(q);

        if (!itemNameMatch && !performedByMatch && !emailMatch && !customerMatch && !supplierMatch && !rawStringMatch) {
          return false;
        }
      }

      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  // Quick summary metrics calculation
  const metrics = useMemo(() => {
    let salesCount = 0;
    let salesUnits = 0;
    let purchasesCount = 0;
    let purchaseUnits = 0;
    let stockAdjustCount = 0;

    filteredLogs.forEach(log => {
      if (log.action === 'SALE') {
        salesCount++;
        const qty = log.changes?.after?.sale?.quantity || 
          (log.changes?.before?.total !== undefined && log.changes?.after?.total !== undefined 
            ? Math.max(0, log.changes.before.total - log.changes.after.total) 
            : 0);
        salesUnits += Number(qty) || 0;
      } else if (log.action === 'PURCHASE') {
        purchasesCount++;
        const qty = log.changes?.after?.purchase?.quantity || 
          (log.changes?.before?.total !== undefined && log.changes?.after?.total !== undefined 
            ? Math.max(0, log.changes.after.total - log.changes.before.total) 
            : 0);
        purchaseUnits += Number(qty) || 0;
      } else if (log.action === 'STOCK_ADJUST') {
        stockAdjustCount++;
      }
    });

    return {
      totalLogs: filteredLogs.length,
      salesCount,
      salesUnits,
      purchasesCount,
      purchaseUnits,
      stockAdjustCount
    };
  }, [filteredLogs]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, actionFilter, dateFilter, customRange]);

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No logs available to export.');
      return;
    }

    const headers = [
      'Date & Time',
      'Action',
      'Item Name',
      'Performed By',
      'User Email',
      'Details / Customer / Supplier',
      'Stock Before',
      'Stock After',
      'Stock Diff',
      'Upper Before -> After',
      'Down Before -> After',
      'Nagdevi Before -> After'
    ];

    const rows = filteredLogs.map(log => {
      const dt = formatLogDateTime(log.timestamp);
      const b = log.changes?.before;
      const a = log.changes?.after;

      let detailsStr = '';
      if (log.action === 'SALE' && a?.sale) {
        detailsStr = `Customer: ${a.sale.customerName || ''} | Company: ${a.sale.companyName || ''} | Rate: ₹${a.sale.unitPrice || 0} | Total: ₹${a.sale.totalAmount || 0}`;
      } else if (log.action === 'PURCHASE' && a?.purchase) {
        detailsStr = `Supplier: ${a.purchase.supplierName || ''} | Rate: ₹${a.purchase.unitPrice || 0} | Total: ₹${a.purchase.totalAmount || 0}`;
      } else if (typeof a === 'string') {
        detailsStr = a;
      } else if (typeof b === 'string') {
        detailsStr = b;
      }

      const totalBefore = b?.total ?? '';
      const totalAfter = a?.total ?? '';
      const totalDiff = (typeof totalBefore === 'number' && typeof totalAfter === 'number') 
        ? totalAfter - totalBefore 
        : '';

      const upperStr = (b?.upper !== undefined && a?.upper !== undefined) ? `${b.upper} -> ${a.upper}` : '';
      const downStr = (b?.down !== undefined && a?.down !== undefined) ? `${b.down} -> ${a.down}` : '';
      const nagdeviStr = (b?.nagdevi !== undefined && a?.nagdevi !== undefined) ? `${b.nagdevi} -> ${a.nagdevi}` : '';

      return [
        `"${dt.full}"`,
        `"${log.action}"`,
        `"${(log.itemName || '').replace(/"/g, '""')}"`,
        `"${(log.performedBy || '').replace(/"/g, '""')}"`,
        `"${(log.performedByEmail || '').replace(/"/g, '""')}"`,
        `"${detailsStr.replace(/"/g, '""')}"`,
        `"${totalBefore}"`,
        `"${totalAfter}"`,
        `"${totalDiff}"`,
        `"${upperStr}"`,
        `"${downStr}"`,
        `"${nagdeviStr}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `stock_change_logs_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const actionTabs: { id: ActionFilterType; label: string; count?: number; color: string }[] = [
    { id: 'ALL', label: 'All Activities', color: 'blue' },
    { id: 'SALE', label: 'Sales Only', count: metrics.salesCount, color: 'red' },
    { id: 'PURCHASE', label: 'Purchases Only', count: metrics.purchasesCount, color: 'emerald' },
    { id: 'STOCK_ADJUST', label: 'Manual Stock Adjusts', count: metrics.stockAdjustCount, color: 'purple' },
    { id: 'UPDATE', label: 'Price & Details Edits', color: 'blue' },
    { id: 'CREATE_DELETE', label: 'New / Deleted Items', color: 'slate' },
  ];

  const dateOptions: { id: DateFilterType; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom Dates' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header & Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
            <History size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Stock Change Logs</h1>
              <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase border border-blue-100">
                Live Audit Trail
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Every single modification with date, exact before/after quantities, and user identity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            title="Refresh audit logs"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-100"
            title="Export filtered records to Excel / CSV"
          >
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Dad-Friendly Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Changes</span>
            <History size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalLogs}</div>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Audit events recorded</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Stock Sales</span>
            <ShoppingCart size={16} className="text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600">
            {metrics.salesCount} <span className="text-xs font-bold text-slate-500">events</span>
          </div>
          <p className="text-[11px] text-red-600/80 font-bold mt-0.5">
            -{metrics.salesUnits} units sold
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Stock Purchases</span>
            <Truck size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {metrics.purchasesCount} <span className="text-xs font-bold text-slate-500">events</span>
          </div>
          <p className="text-[11px] text-emerald-600/80 font-bold mt-0.5">
            +{metrics.purchaseUnits} units added
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Stock Adjustments</span>
            <PackageCheck size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600">
            {metrics.stockAdjustCount} <span className="text-xs font-bold text-slate-500">edits</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Direct manual corrections</p>
        </div>
      </div>

      {/* 3. Search Bar and Filter Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Row 1: Search input + Date Selector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Real-time search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Item Name, Customer, Supplier, or User..."
              className="w-full pl-10 pr-10 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Simple Date Pill Selector */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl overflow-x-auto no-scrollbar shrink-0">
            {dateOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateFilter(opt.id)}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  dateFilter === opt.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker (shown when 'custom' is active) */}
        <AnimatePresence>
          {dateFilter === 'custom' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-end gap-4 mt-2">
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="date"
                      value={customRange.start}
                      onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="date"
                      value={customRange.end}
                      onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setCustomRange({ start: '', end: '' })}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-red-600 bg-white border border-slate-200 rounded-xl transition-all shrink-0"
                >
                  Clear Range
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 2: Action Filters Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0 mr-1">
            Filter Action:
          </span>
          {actionTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActionFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                actionFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  actionFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}

          {(searchQuery || actionFilter !== 'ALL' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActionFilter('ALL');
                setDateFilter('all');
                setCustomRange({ start: '', end: '' });
              }}
              className="ml-auto text-xs font-black uppercase tracking-wider text-red-600 hover:text-red-700 underline shrink-0 px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Logs Feed List */}
      <div className="space-y-3 relative">
        {isLoading && (
          <div className="absolute inset-x-0 -top-3 px-4 py-1.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full w-fit mx-auto shadow-lg z-10 animate-pulse">
            Syncing logs with database...
          </div>
        )}

        {filteredLogs.length === 0 && !isLoading && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm p-8">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
              <Clock size={32} />
            </div>
            <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">No change logs found</h4>
            <p className="text-xs font-semibold text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || actionFilter !== 'ALL' || dateFilter !== 'all'
                ? 'No activities match your current search or filter criteria. Try resetting the filters.'
                : 'No modifications have been recorded in the database yet.'}
            </p>
            {(searchQuery || actionFilter !== 'ALL' || dateFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActionFilter('ALL');
                  setDateFilter('all');
                  setCustomRange({ start: '', end: '' });
                }}
                className="mt-4 px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {paginatedLogs.map((log) => (
          <AuditLogCard key={log.id} log={log} />
        ))}
      </div>

      {/* 5. Pagination Controls */}
      {filteredLogs.length > itemsPerPage && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-bold text-slate-500">
            Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of{' '}
            <span className="text-slate-900">{filteredLogs.length}</span> activities
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs font-black text-slate-700 px-3 py-1 bg-slate-100 rounded-lg">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
