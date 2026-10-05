import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Navbar } from './components/Navbar';
import { ExcelImport } from './components/ExcelImport';
import { ManualEntryForm } from './components/ManualEntryForm';
import { InventoryTable } from './components/InventoryTable';
import { ActivityFeed } from './components/ActivityLog';
import { SalesTab } from './components/SalesTab';
import { PurchaseTab } from './components/PurchaseTab';
import { StatusModal, StatusType } from './components/StatusModal';
import { inventoryService } from './services/inventoryService';
import { InventoryItem, AuditLog } from './types';
import { Package, Plus, Loader2, LayoutDashboard, Database, TrendingUp, ChevronUp, ChevronDown, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [view, setView] = useState<'inventory' | 'sales' | 'purchase' | 'history'>('inventory');
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'all' | 'upper' | 'down' | 'nagdevi'>('all');
  
  // Status Modal State
  const [statusState, setStatusState] = useState<{
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currUser) => {
      setItems([]);
      setUser(currUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const unsubscribeInventory = inventoryService.subscribeToInventory((newItems) => {
      setItems(newItems);
    });

    return () => {
      unsubscribeInventory();
    };
  }, [user]);

  const handleAddSingleItem = async (formItem: { name: string; price: string; boxPacking: string; upper: string; down: string; nagdevi: string }) => {
    const upper = Number(formItem.upper) || 0;
    const down = Number(formItem.down) || 0;
    const nagdevi = Number(formItem.nagdevi) || 0;
    const priceValue = Number(formItem.price) || 0;
    const nameUpper = formItem.name.toUpperCase();
    const boxPackingUpper = formItem.boxPacking.toUpperCase().trim();

    // 1. Generate optimistic item with a temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: InventoryItem = {
      id: tempId,
      name: nameUpper,
      price: priceValue,
      quantity: upper + down + nagdevi,
      upperOfficeQty: upper,
      downOfficeQty: down,
      nagdeviOfficeQty: nagdevi,
      ownerId: user?.uid || '',
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      orderIndex: Date.now(),
      boxPacking: boxPackingUpper,
    };

    // Calculate actual order index using the same alphabetical insertion logic
    let calculatedOrderIndex = Date.now();
    if (items.length > 0) {
      const sortedByName = [...items].sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      const insertionIndex = sortedByName.findIndex(existingItem => 
        existingItem.name.localeCompare(nameUpper, undefined, { numeric: true, sensitivity: 'base' }) >= 0
      );

      if (insertionIndex === -1) {
        const lastAlphaItem = sortedByName[sortedByName.length - 1];
        calculatedOrderIndex = (lastAlphaItem.orderIndex ?? Date.now()) + 1000;
      } else if (insertionIndex === 0) {
        const firstAlphaItem = sortedByName[0];
        calculatedOrderIndex = (firstAlphaItem.orderIndex ?? Date.now()) - 1000;
      } else {
        const prevItem = sortedByName[insertionIndex - 1];
        const nextItem = sortedByName[insertionIndex];
        calculatedOrderIndex = ((prevItem.orderIndex ?? Date.now()) + (nextItem.orderIndex ?? Date.now())) / 2;
      }
    }
    optimisticItem.orderIndex = calculatedOrderIndex;

    // 2. Synchronously update items state so it shows up in the table instantly!
    setItems((prev) => {
      if (prev.some(i => i.name === nameUpper)) return prev;
      const nextItems = [...prev, optimisticItem];
      return nextItems.sort((a, b) => {
        const orderA = a.orderIndex !== undefined ? a.orderIndex : 0;
        const orderB = b.orderIndex !== undefined ? b.orderIndex : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    });

    // 3. Immediately display the success status feedback
    setStatusState({
      isOpen: true,
      type: 'success',
      title: 'Item Added',
      message: `${nameUpper} has been added successfully.`
    });

    // 4. Asynchronously send the request to FireStore in the background
    try {
      await inventoryService.addItem({
        name: nameUpper,
        price: priceValue,
        quantity: upper + down + nagdevi,
        upperOfficeQty: upper,
        downOfficeQty: down,
        nagdeviOfficeQty: nagdevi,
        boxPacking: boxPackingUpper || undefined,
      }, items);
    } catch (error) {
      // Revert from UI on rare background failures
      setItems((prev) => prev.filter(i => i.id !== tempId));
      setStatusState({
        isOpen: true,
        type: 'error',
        title: 'Failed to Add',
        message: 'Could not save the item. Please try again.'
      });
    }
  };

  const totalItems = items.length;
  
  const filteredForStats = items.filter(item => {
    if (locationFilter === 'all') return true;
    if (locationFilter === 'upper') return (item.upperOfficeQty || 0) > 0;
    if (locationFilter === 'down') return (item.downOfficeQty || 0) > 0;
    if (locationFilter === 'nagdevi') return (item.nagdeviOfficeQty || 0) > 0;
    return true;
  });

  const getDisplayValue = () => {
    if (locationFilter === 'all') return items.reduce((acc, i) => acc + i.quantity, 0);
    if (locationFilter === 'upper') return items.reduce((acc, i) => acc + (i.upperOfficeQty || 0), 0);
    if (locationFilter === 'down') return items.reduce((acc, i) => acc + (i.downOfficeQty || 0), 0);
    if (locationFilter === 'nagdevi') return items.reduce((acc, i) => acc + (i.nagdeviOfficeQty || 0), 0);
    return 0;
  };

  const activeQty = getDisplayValue();
  const activeCount = filteredForStats.length;
  const lowStockCount = filteredForStats.filter(i => {
    const qty = locationFilter === 'all' ? i.quantity : 
                locationFilter === 'upper' ? (i.upperOfficeQty || 0) :
                locationFilter === 'down' ? (i.downOfficeQty || 0) :
                (i.nagdeviOfficeQty || 0);
    return qty > 0 && qty <= 5;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} />

      <main className="flex-1 w-full max-w-[1700px] mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-8 mt-12 overflow-hidden shadow-xl shadow-blue-100">
              <img src="/logo.png" alt="Vardhaman Logo" className="w-full h-full object-cover opacity-50" onError={(e) => e.currentTarget.style.display = 'none'} />
              <Package size={40} className="absolute text-blue-600" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Vardhaman Sales Corp</h1>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-bold leading-relaxed uppercase text-xs tracking-widest">
              Professional Inventory Management Suite with Secure Audit Logs and Real-time Tracking.
            </p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Dashboard Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <motion.div layout>
                  <StatCard 
                    label={locationFilter === 'all' ? "TOTAL PRODUCTS" : `${locationFilter.toUpperCase()} Office ITEMS`} 
                    value={activeCount} 
                    icon={<Package className="text-blue-600" />} 
                    color="bg-blue-50"
                  />
                </motion.div>
                <motion.div layout>
                  <StatCard 
                    label={locationFilter === 'all' ? "TOTAL STOCK (ALL)" : `${locationFilter.toUpperCase()} Office Stock`} 
                    value={activeQty} 
                    icon={<Database className="text-emerald-600" />} 
                    color="bg-emerald-50"
                  />
                </motion.div>
                <motion.div layout>
                  <StatCard 
                    label="LOW STOCK ALERT" 
                    value={lowStockCount} 
                    icon={<TrendingUp className="text-amber-600" />} 
                    color="bg-amber-50"
                    highlight={lowStockCount > 0}
                  />
                </motion.div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit mb-4">
                <button 
                  onClick={() => setView('inventory')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    view === 'inventory' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Package size={18} />
                  Stock List
                </button>
                <button 
                  onClick={() => setView('sales')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    view === 'sales' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <TrendingUp size={18} />
                  Sales
                </button>
                <button 
                  onClick={() => setView('purchase')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    view === 'purchase' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <TrendingUp size={18} />
                  Purchases
                </button>
                <button 
                  onClick={() => setView('history')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    view === 'history' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <History size={18} />
                  Change Logs
                </button>
              </div>

              {view === 'inventory' ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <ManualEntryForm 
                      onAdd={handleAddSingleItem} 
                      isProcessing={isProcessing} 
                    />
                    <ExcelImport />
                  </div>

                  <div className="w-full overflow-hidden">
                    <InventoryTable 
                      items={items} 
                      setItems={setItems}
                      locationFilter={locationFilter} 
                      onFilterChange={setLocationFilter} 
                    />
                  </div>
                </div>
              ) : view === 'sales' ? (
                <div className="max-w-6xl">
                  <SalesTab />
                </div>
              ) : view === 'purchase' ? (
                <div className="max-w-6xl">
                  <PurchaseTab />
                </div>
              ) : (
                <div className="max-w-4xl">
                  <ActivityFeed />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-12 px-8">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Vardhaman Sales Corp</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Stock Management System © 2026</p>
          </div>
        </div>
      </footer>

      <StatusModal
        isOpen={statusState.isOpen}
        onClose={() => setStatusState({ ...statusState, isOpen: false })}
        type={statusState.type}
        title={statusState.title}
        message={statusState.message}
      />
    </div>
  );
}

function StatCard({ label, value, icon, color, highlight = false }: { label: string, value: number, icon: React.ReactNode, color: string, highlight?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black ${highlight ? 'text-amber-600' : 'text-slate-900'}`}>
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
