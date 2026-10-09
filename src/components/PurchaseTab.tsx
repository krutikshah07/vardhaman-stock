import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, IndianRupee, MapPinned, Pencil, Search, Trash2, Truck, FileSpreadsheet } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { PurchaseRecord, SaleLocation } from '../types';
import { DeleteRecordModal } from './DeleteRecordModal';
import { EditPurchaseModal } from './EditPurchaseModal';
import { StatusModal, StatusType } from './StatusModal';

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

const getTimestampMillis = (value: any): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const seconds = Number(value?.seconds ?? value?._seconds ?? 0);
  if (seconds > 0) return seconds * 1000;
  return 0;
};

export const PurchaseTab: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState<{ isOpen: boolean; purchase: PurchaseRecord | null }>({
    isOpen: false,
    purchase: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; purchase: PurchaseRecord | null }>({
    isOpen: false,
    purchase: null,
  });
  const [statusState, setStatusState] = useState<{
    isOpen: boolean;
    type: StatusType;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  useEffect(() => {
    const unsubscribe = inventoryService.subscribeToPurchases((nextPurchases) => {
      setPurchases(nextPurchases);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Always sorted with newest entries at the very top
  const sortedPurchases = useMemo(() => {
    return [...purchases].sort((a, b) => {
      const timeA = getTimestampMillis(a.purchasedAt);
      const timeB = getTimestampMillis(b.purchasedAt);
      return timeB - timeA;
    });
  }, [purchases]);

  // Search filter matching item name, supplier name, or location
  const filteredPurchases = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return sortedPurchases;

    return sortedPurchases.filter((purchase) => {
      const name = (purchase.itemName || '').toLowerCase();
      const supplier = (purchase.supplierName || '').toLowerCase();
      const location = (purchase.location || '').toLowerCase();
      return (
        name.includes(query) ||
        supplier.includes(query) ||
        location.includes(query)
      );
    });
  }, [sortedPurchases, searchTerm]);

  const totalSpend = useMemo(
    () => filteredPurchases.reduce((acc, purchase) => acc + (purchase.totalAmount || 0), 0),
    [filteredPurchases]
  );

  const totalUnits = useMemo(
    () => filteredPurchases.reduce((acc, purchase) => acc + (purchase.quantity || 0), 0),
    [filteredPurchases]
  );

  const handleEditClick = (purchase: PurchaseRecord) => {
    setEditModal({ isOpen: true, purchase });
  };

  const handleConfirmEdit = async (updates: {
    supplierName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
  }) => {
    if (!editModal.purchase) return;
    const origPurchase = editModal.purchase;
    if (!origPurchase.id) {
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Update Error',
        message: 'This record cannot be edited because it is missing a valid database ID.',
      });
      setEditModal({ isOpen: false, purchase: null });
      return;
    }
    const totalAmount = updates.quantity * updates.unitPrice;
    setEditModal({ isOpen: false, purchase: null });

    // Optimistically update in UI only for this exact record
    setPurchases((prev) =>
      prev.map((p) =>
        p.id === origPurchase.id
          ? {
              ...p,
              supplierName: updates.supplierName,
              quantity: updates.quantity,
              unitPrice: updates.unitPrice,
              totalAmount,
              location: updates.location,
            }
          : p
      )
    );

    try {
      await inventoryService.updatePurchase(origPurchase.id, updates);
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Entry Updated',
        message: `Purchase record for ${origPurchase.itemName.toUpperCase()} updated successfully.`,
      });
    } catch (error) {
      // Revert if error
      setPurchases((prev) => prev.map((p) => (p.id === origPurchase.id ? origPurchase : p)));
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Could not update the purchase entry. Please try again.',
      });
    }
  };

  const handleDeleteClick = (purchase: PurchaseRecord) => {
    setDeleteModal({ isOpen: true, purchase });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.purchase) return;
    const purchaseToDelete = deleteModal.purchase;
    setDeleteModal({ isOpen: false, purchase: null });

    if (!purchaseToDelete.id) {
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Delete Error',
        message: 'This record cannot be deleted because it lacks a valid database ID.',
      });
      return;
    }

    // Optimistically remove ONLY this specific record from UI
    setPurchases((prev) => {
      const idx = prev.findIndex((p) => p.id === purchaseToDelete.id);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });

    try {
      await inventoryService.deletePurchase(purchaseToDelete.id);
      setStatusState({
        isOpen: true,
        type: 'success',
        title: 'Entry Deleted',
        message: `Purchase record for ${purchaseToDelete.itemName.toUpperCase()} has been removed.`,
      });
    } catch (error) {
      // Revert if error - put it back in the list
      setPurchases((prev) => [purchaseToDelete, ...prev]);
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Could not delete the purchase entry. Please try again.',
      });
    }
  };

  const handleExportCSV = () => {
    if (filteredPurchases.length === 0) return;
    const headers = ['Date', 'Item Name', 'Supplier Name', 'Box Packing', 'Quantity', 'Cost / Rate (₹)', 'Total Amount (₹)', 'Location', 'Notes'];
    const rows = filteredPurchases.map((p) => [
      `"${formatRecordDate(p.purchasedAt)}"`,
      `"${(p.itemName || '').replace(/"/g, '""')}"`,
      `"${(p.supplierName || '').replace(/"/g, '""')}"`,
      `"${(p.boxPacking || '').replace(/"/g, '""')}"`,
      p.quantity,
      p.unitPrice,
      p.totalAmount,
      `"${p.location}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Entries</p>
              <h3 className="text-2xl font-black text-slate-900">{filteredPurchases.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <PackageIcon />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units Added</p>
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Spend</p>
              <h3 className="text-2xl font-black text-slate-900">{formatMoney(totalSpend)}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input
          type="text"
          placeholder="Search purchases by product, supplier, or office..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium uppercase text-sm"
        />
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Purchase Ledger</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Sorted by Most Recent
            </span>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-sm"
              title="Download Purchases as CSV"
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
                    {searchTerm ? 'No matching purchases found' : 'No purchases recorded yet'}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase, index) => (
                  <tr key={purchase.id ? `purchase-${purchase.id}` : `purchase-fallback-${index}-${purchase.itemName}-${getTimestampMillis(purchase.purchasedAt)}`} className="align-middle hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-4 font-black text-slate-900 uppercase">{purchase.itemName}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <Building2 size={14} className="text-slate-400" />
                        {purchase.supplierName}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black text-blue-600">{purchase.quantity}</td>
                    <td className="px-4 py-4 font-black text-slate-800">{formatMoney(purchase.unitPrice)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold uppercase">
                        <MapPinned size={14} className="text-slate-400" />
                        {purchase.location}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <CalendarClock size={14} className="text-slate-400" />
                        {formatRecordDate(purchase.purchasedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black text-amber-700">{formatMoney(purchase.totalAmount)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(purchase)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                          title="Edit Purchase Record"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(purchase)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                          title="Delete Purchase Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditPurchaseModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, purchase: null })}
        onConfirm={handleConfirmEdit}
        purchase={editModal.purchase}
      />

      <DeleteRecordModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, purchase: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Purchase Entry?"
        description={`Are you sure you want to delete this purchase entry of "${deleteModal.purchase?.quantity} units of ${deleteModal.purchase?.itemName.toUpperCase()}" from ${deleteModal.purchase?.supplierName}? This will permanently remove the record from the ledger.`}
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

const PackageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
    <path d="M12 3v18" />
    <path d="M4 7l8 4 8-4" />
  </svg>
);
