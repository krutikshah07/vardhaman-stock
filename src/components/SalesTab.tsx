import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, IndianRupee, MapPinned, ShoppingBag, UserRound } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { SaleRecord } from '../types';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const formatRecordDate = (value: any) => {
  if (!value) return '—';
  if (value instanceof Date) {
    return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const seconds = Number(value?.seconds ?? value?._seconds ?? 0);
  if (seconds > 0) {
    return new Date(seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return '—';
};

export const SalesTab: React.FC = () => {
  const [sales, setSales] = useState<SaleRecord[]>([]);

  useEffect(() => {
    const unsubscribe = inventoryService.subscribeToSales((nextSales) => {
      setSales(nextSales);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const totalRevenue = useMemo(
    () => sales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0),
    [sales]
  );

  const totalUnits = useMemo(
    () => sales.reduce((acc, sale) => acc + (sale.quantity || 0), 0),
    [sales]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sold Entries</p>
              <h3 className="text-2xl font-black text-slate-900">{sales.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <PackageIcon />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units Sold</p>
              <h3 className="text-2xl font-black text-slate-900">{totalUnits}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <IndianRupee size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
              <h3 className="text-2xl font-black text-slate-900">{formatMoney(totalRevenue)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sales Ledger</h2>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    No sales recorded yet
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4 font-black text-slate-900 uppercase">{sale.itemName}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <UserRound size={14} className="text-slate-400" />
                        {sale.customerName}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Building2 size={14} className="text-slate-400" />
                        {sale.companyName}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black text-blue-600">{sale.quantity}</td>
                    <td className="px-4 py-4 font-black text-slate-800">{formatMoney(sale.unitPrice)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold uppercase">
                        <MapPinned size={14} className="text-slate-400" />
                        {sale.location}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <CalendarClock size={14} className="text-slate-400" />
                        {formatRecordDate(sale.soldAt)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-700">{formatMoney(sale.totalAmount)}</td>
                    <td className="px-4 py-4 max-w-[220px] text-slate-600 text-sm">{sale.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PackageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
    <path d="M12 3v18" />
    <path d="M4 7l8 4 8-4" />
  </svg>
);
