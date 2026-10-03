import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuditLog } from '../types';
import { inventoryService } from '../services/inventoryService';
import { History, Plus, Edit, Trash2, PackageCheck, Upload, Trash, User, Filter, Calendar, Clock, X } from 'lucide-react';

type TimeFilter = '1h' | '3h' | '5h' | '6h' | '24h' | '3d' | '7d' | '15d' | '20d' | '25d' | '30d' | 'custom';

const AuditLogItem = React.memo(({ log, index }: { log: AuditLog; index: number }) => {
  const getActionIcon = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE': return <Plus size={16} className="text-emerald-600" />;
      case 'UPDATE': return <Edit size={16} className="text-blue-600" />;
      case 'DELETE': return <Trash2 size={16} className="text-red-600" />;
      case 'STOCK_ADJUST': return <PackageCheck size={16} className="text-violet-600" />;
      case 'BATCH_IMPORT': return <Upload size={16} className="text-emerald-600" />;
      case 'BATCH_DELETE': return <Trash size={16} className="text-red-600" />;
      default: return <History size={16} />;
    }
  };

  const getActionLabel = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE': return 'Added New Item';
      case 'UPDATE': return 'Edited Details';
      case 'DELETE': return 'Removed Item';
      case 'STOCK_ADJUST': return 'Adjusted Stock';
      case 'BATCH_IMPORT': return 'Batch Imported';
      case 'BATCH_DELETE': return 'Batch Deleted All';
      default: return action;
    }
  };

  const formatChanges = (log: AuditLog) => {
    if (!log.changes) return null;

    if (log.action === 'STOCK_ADJUST' && log.changes.before && log.changes.after) {
      const before = log.changes.before;
      const after = log.changes.after;
      
      const parts = [];
      if (before.upper !== after.upper) parts.push(`Upper: ${before.upper}→${after.upper}`);
      if (before.down !== after.down) parts.push(`Down: ${before.down}→${after.down}`);
      if (before.nagdevi !== after.nagdevi) parts.push(`Nagdevi: ${before.nagdevi}→${after.nagdevi}`);
      
      return parts.join(' | ');
    }

    if (log.action === 'UPDATE' && log.changes.before && log.changes.after) {
      const before = log.changes.before;
      const after = log.changes.after;
      const parts = [];
      if (before.name !== after.name) parts.push(`Name: "${before.name}" → "${after.name}"`);
      if (before.price !== after.price) parts.push(`Price: ₹${before.price} → ₹${after.price}`);
      return parts.join(' | ');
    }

    if (typeof log.changes.before === 'string') return log.changes.before;
    if (typeof log.changes.after === 'string') return log.changes.after;

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 group hover:border-blue-200 transition-all hover:shadow-md"
    >
      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${
        log.action === 'DELETE' || log.action === 'BATCH_DELETE' ? 'bg-red-50' : 
        log.action === 'CREATE' || log.action === 'BATCH_IMPORT' ? 'bg-emerald-50' : 
        'bg-blue-50'
      }`}>
        {getActionIcon(log.action)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
          <div>
            <h4 className="text-base font-black text-slate-900 uppercase truncate">
              {log.itemName}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-100">
                {getActionLabel(log.action)}
              </span>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <User size={10} />
                {log.performedBy}
              </div>
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 whitespace-nowrap bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now'}
          </div>
        </div>

        {log.changes && (
          <div className="text-[11px] font-bold text-slate-500 bg-slate-50/50 p-3 rounded-xl border border-slate-100 italic font-mono">
            {formatChanges(log) || 'Modification details successfully logged'}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export const ActivityFeed: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<TimeFilter>('24h');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filter !== 'custom') {
      const now = new Date();
      startDate = new Date();
      
      switch (filter) {
        case '1h': startDate.setHours(now.getHours() - 1); break;
        case '3h': startDate.setHours(now.getHours() - 3); break;
        case '5h': startDate.setHours(now.getHours() - 5); break;
        case '6h': startDate.setHours(now.getHours() - 6); break;
        case '24h': startDate.setHours(now.getHours() - 24); break;
        case '3d': startDate.setDate(now.getDate() - 3); break;
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '15d': startDate.setDate(now.getDate() - 15); break;
        case '20d': startDate.setDate(now.getDate() - 20); break;
        case '25d': startDate.setDate(now.getDate() - 25); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
      }
    } else {
      if (customRange.start) startDate = new Date(customRange.start);
      if (customRange.end) {
        endDate = new Date(customRange.end);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    let active = true;
    setIsLoading(true);

    const loadLogs = async () => {
      const nextLogs = await inventoryService.fetchAuditLogsOnce(startDate, endDate);
      if (active) {
        setLogs(nextLogs);
        setIsLoading(false);
      }
    };

    loadLogs();

    return () => {
      active = false;
    };
  }, [filter, customRange]);

  const timeOptions: { value: TimeFilter; label: string }[] = [
    { value: '1h', label: '1 Hour' },
    { value: '3h', label: '3 Hours' },
    { value: '5h', label: '5 Hours' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '1 Day' },
    { value: '3d', label: '3 Days' },
    { value: '7d', label: '1 Week' },
    { value: '15d', label: '15 Days' },
    { value: '20d', label: '20 Days' },
    { value: '25d', label: '25 Days' },
    { value: '30d', label: '1 Month' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="text-slate-400" size={24} />
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Audit Trail</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking all system modifications</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {timeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                filter === opt.value 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {filter === 'custom' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-end gap-4 mb-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-sm"
                  />
                </div>
              </div>
              <button 
                onClick={() => setCustomRange({ start: '', end: '' })}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Clear Filter"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 relative">
        {isLoading && (
          <div className="absolute inset-x-0 -top-1 px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full w-fit mx-auto shadow-lg z-10 animate-pulse">
            Syncing logs...
          </div>
        )}

        {logs.length === 0 && !isLoading && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
              <Clock size={32} />
            </div>
            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">No actions found</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Try adjusting your time filter</p>
          </div>
        )}
        
        {logs.map((log, index) => (
          <AuditLogItem key={log.id} log={log} index={index} />
        ))}
      </div>
    </div>
  );
};
