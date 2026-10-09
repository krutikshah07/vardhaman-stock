import React from 'react';
import { CheckCircle2, AlertTriangle, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReconciliationReport } from '../types';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReconciliationReport | null;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  if (!isOpen || !report) return null;

  const hasIssues = report.missingItems.length > 0;
  const isPerfectMatch = !hasIssues && report.changedItems.length === 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                hasIssues ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {hasIssues ? <AlertTriangle size={22} /> : <ShieldCheck size={22} />}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Data Reconciliation Audit
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Before vs. After Verification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Status Summary Banner */}
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              isPerfectMatch
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : hasIssues
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <CheckCircle2 size={24} className="shrink-0" />
              <div className="text-xs font-bold uppercase leading-relaxed">
                {isPerfectMatch && '100% Reconciliation Passed: All item names, prices, and quantities verified with zero discrepancy.'}
                {hasIssues && `Attention: ${report.missingItems.length} items from the previous list were not found in the new list.`}
                {!isPerfectMatch && !hasIssues && `Import Verified: ${report.afterCount} items loaded. ${report.exactMatchesCount} exact matches, ${report.newItems.length} new items.`}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Previous Items</p>
                <p className="text-xl font-black text-slate-900">{report.beforeCount}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">New Items Count</p>
                <p className="text-xl font-black text-blue-600">{report.afterCount}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Exact Matches</p>
                <p className="text-xl font-black text-emerald-600">{report.exactMatchesCount}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">New Items Added</p>
                <p className="text-xl font-black text-indigo-600">{report.newItems.length}</p>
              </div>
            </div>

            {/* Stock Quantities Comparison */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Total Stock (Before)</p>
                <p className="text-base font-black text-slate-800">{report.beforeTotalQty} units</p>
              </div>
              <ArrowRight size={20} className="text-slate-400" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Total Stock (After)</p>
                <p className="text-base font-black text-slate-900">{report.afterTotalQty} units</p>
              </div>
            </div>

            {/* Missing Items Warning List */}
            {report.missingItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-red-600 uppercase flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  Items in previous list but missing in new list ({report.missingItems.length})
                </h4>
                <div className="max-h-36 overflow-y-auto bg-red-50/50 p-3 rounded-xl border border-red-100 divide-y divide-red-100/80 text-xs font-bold text-red-900 uppercase">
                  {report.missingItems.map((name, i) => (
                    <div key={i} className="py-1">{name}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Changed Items Detail List */}
            {report.changedItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-700 uppercase">
                  Updated Items ({report.changedItems.length})
                </h4>
                <div className="max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs font-medium uppercase">
                  {report.changedItems.map((item, i) => (
                    <div key={i} className="py-2 flex justify-between items-center">
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">{item.name}</span>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Qty: {item.beforeQty} → <strong className="text-blue-600">{item.afterQty}</strong> | Price: ₹{item.beforePrice} → <strong className="text-emerald-600">₹{item.afterPrice}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Newly Added Items List */}
            {report.newItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-indigo-700 uppercase">
                  Newly Added Items ({report.newItems.length})
                </h4>
                <div className="max-h-36 overflow-y-auto bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs font-bold text-indigo-900 uppercase divide-y divide-indigo-100">
                  {report.newItems.map((name, i) => (
                    <div key={i} className="py-1 truncate">{name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-slate-200"
            >
              Close Verification
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

