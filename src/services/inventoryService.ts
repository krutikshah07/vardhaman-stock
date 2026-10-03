import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { InventoryItem, NewInventoryItem, AuditLog, AuditAction, SaleRecord, PurchaseRecord, SaleLocation } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_PATH = 'inventory';
const AUDIT_COLLECTION = 'audit_logs';
const SALES_COLLECTION = 'sales';
const PURCHASES_COLLECTION = 'purchases';
const INVENTORY_CACHE_KEY = 'stockwise_inventory_cache';
const SALES_CACHE_KEY = 'stockwise_sales_cache';
const PURCHASES_CACHE_KEY = 'stockwise_purchase_cache';
const AUDIT_CACHE_KEY = 'stockwise_audit_cache';

const readLocalCache = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [] as T[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to read local cache for ${key}:`, error);
    return [] as T[];
  }
};

const writeLocalCache = <T>(key: string, value: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write local cache for ${key}:`, error);
  }
};

const isQuotaExceededError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: string }).code;
  const maybeMessage = (error as { message?: string }).message || '';
  return maybeCode === 'resource-exhausted' || maybeCode === 'quota-exceeded' || maybeMessage.toLowerCase().includes('quota exceeded');
};

const listenerRegistry = new Map<string, () => void>();

const ensureSingleListener = <T>(key: string, subscribe: () => () => void, fallback: () => T[]) => {
  const existingUnsubscribe = listenerRegistry.get(key);
  if (existingUnsubscribe) {
    existingUnsubscribe();
    listenerRegistry.delete(key);
  }

  const unsubscribe = subscribe();
  listenerRegistry.set(key, unsubscribe);

  return () => {
    unsubscribe();
    listenerRegistry.delete(key);
  };
};

const logActivity = async (
  action: AuditAction, 
  itemName: string, 
  itemId?: string, 
  changes?: { before?: any, after?: any }
) => {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, AUDIT_COLLECTION), {
      action,
      itemName,
      itemId: itemId || null,
      changes: changes || null,
      timestamp: serverTimestamp(),
      performedBy: auth.currentUser.displayName || 'Anonymous',
      performedByEmail: auth.currentUser.email || 'unknown',
      ownerId: auth.currentUser.uid // For security rules / filtering
    });
  } catch (error) {
    console.warn('Failed to log audit activity:', error);
  }
};

export const inventoryService = {
  subscribeToInventory: (callback: (items: InventoryItem[]) => void) => {
    if (!auth.currentUser) return () => {};

    const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
    if (cachedItems.length > 0) {
      callback(cachedItems);
    }

    const q = query(
      collection(db, COLLECTION_PATH),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const key = `inventory:${auth.currentUser.uid}`;
    return ensureSingleListener(key, () => onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];

      items.sort((a, b) => {
        const orderA = a.orderIndex !== undefined ? a.orderIndex : 0;
        const orderB = b.orderIndex !== undefined ? b.orderIndex : 0;
        if (orderA !== orderB) return orderA - orderB;

        const nameComparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        if (nameComparison !== 0) return nameComparison;

        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        if (timeA !== timeB) return timeA - timeB;

        return a.id.localeCompare(b.id);
      });

      writeLocalCache(INVENTORY_CACHE_KEY, items);
      callback(items);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Inventory listener quota exceeded, using local cache only:', error);
        callback(readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY));
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Inventory listener error, using local cache:', error);
      callback(readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY));
    }), () => readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY));
  },

  updateAllStockDatesTo27July2026: async () => {
    if (!auth.currentUser) return;
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTION_PATH));

      if (querySnapshot.empty) return;
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const docSnap of querySnapshot.docs) {
        const docRef = doc(db, COLLECTION_PATH, docSnap.id);
        currentBatch.update(docRef, {
          updatedAt: serverTimestamp()
        });
        count++;
        if (count === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      console.log(`Successfully updated dates for all ${querySnapshot.docs.length} stock items to 27 July 2026.`);
      logActivity('UPDATE', 'All Stock Items', undefined, { after: 'Set date of all stock items to 27 July 2026' });
    } catch (error) {
      console.warn('Error updating all stock dates:', error);
      throw error;
    }
  },

  updateAllStockDatesTo26July2026: async () => {
    return inventoryService.updateAllStockDatesTo27July2026();
  },

  migrateMissingOrderIndices: async (items: InventoryItem[]) => {
    if (!auth.currentUser) return;

    // 1. Sort the items using the current display sorting logic
    const sorted = [...items].sort((a, b) => {
      const orderA = a.orderIndex !== undefined ? a.orderIndex : 0;
      const orderB = b.orderIndex !== undefined ? b.orderIndex : 0;
      if (orderA !== orderB) return orderA - orderB;
      
      const nameComparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (nameComparison !== 0) return nameComparison;
      
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      if (timeA !== timeB) return timeA - timeB;
      
      return a.id.localeCompare(b.id);
    });

    // 2. Find contiguous segments of missing order indices and interpolate their values
    const updates: { id: string, name: string, orderIndex: number }[] = [];
    
    let i = 0;
    while (i < sorted.length) {
      if (sorted[i].orderIndex === undefined) {
        const start = i;
        while (i < sorted.length && sorted[i].orderIndex === undefined) {
          i++;
        }
        const end = i - 1;

        const prevItem = start > 0 ? sorted[start - 1] : null;
        const nextItem = i < sorted.length ? sorted[i] : null;

        const prevVal = prevItem?.orderIndex !== undefined ? prevItem.orderIndex : 0;
        const nextVal = nextItem?.orderIndex !== undefined ? nextItem.orderIndex : (sorted.length + 10) * 1000;

        const count = end - start + 1;
        const step = (nextVal - prevVal) / (count + 1);

        for (let j = 0; j < count; j++) {
          const idx = start + j;
          const assignedOrder = prevVal + step * (j + 1);
          updates.push({
            id: sorted[idx].id,
            name: sorted[idx].name,
            orderIndex: assignedOrder
          });
        }
      } else {
        i++;
      }
    }

    if (updates.length === 0) return;

    // 3. Write updates to Firestore in batches
    const batches = [];
    let currentBatch = writeBatch(db);
    let writeCount = 0;

    for (const update of updates) {
      const docRef = doc(db, COLLECTION_PATH, update.id);
      currentBatch.update(docRef, {
        orderIndex: update.orderIndex,
        updatedAt: serverTimestamp()
      });
      writeCount++;
      if (writeCount === 500) {
        batches.push(currentBatch.commit());
        currentBatch = writeBatch(db);
        writeCount = 0;
      }
    }

    if (writeCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    console.log(`Successfully migrated ${updates.length} items with missing orderIndex.`);
  },

  fetchSalesOnce: async (): Promise<SaleRecord[]> => {
    const cachedSales = readLocalCache<SaleRecord>(SALES_CACHE_KEY);
    if (!auth.currentUser) return cachedSales;

    try {
      const q = query(
        collection(db, SALES_COLLECTION),
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('soldAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const sales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SaleRecord[];
      writeLocalCache(SALES_CACHE_KEY, sales);
      return sales;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        console.warn('Sales fetch quota exceeded, using local cache only:', error);
        return cachedSales;
      }
      console.warn('Sales fetch failed, using local cache:', error);
      return cachedSales;
    }
  },

  subscribeToSales: (callback: (sales: SaleRecord[]) => void) => {
    if (!auth.currentUser) return () => {};

    const cachedSales = readLocalCache<SaleRecord>(SALES_CACHE_KEY);
    if (cachedSales.length > 0) {
      callback(cachedSales);
    }

    const q = query(
      collection(db, SALES_COLLECTION),
      where('ownerId', '==', auth.currentUser.uid),
      orderBy('soldAt', 'desc')
    );

    const key = `sales:${auth.currentUser.uid}`;
    return ensureSingleListener(key, () => onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SaleRecord[];
      writeLocalCache(SALES_CACHE_KEY, sales);
      callback(sales);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Sales listener quota exceeded, using local cache only:', error);
        callback(readLocalCache<SaleRecord>(SALES_CACHE_KEY));
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Sales listener error, using local cache:', error);
      callback(readLocalCache<SaleRecord>(SALES_CACHE_KEY));
    }), () => readLocalCache<SaleRecord>(SALES_CACHE_KEY));
  },

  recordSale: async (item: InventoryItem, sale: {
    customerName: string;
    companyName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
    soldAt: Date;
    notes?: string;
  }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const quantity = Number(sale.quantity) || 0;
    if (quantity <= 0) {
      throw new Error('Sale quantity must be greater than zero.');
    }

    const currentQty = sale.location === 'upper'
      ? (item.upperOfficeQty || 0)
      : sale.location === 'down'
        ? (item.downOfficeQty || 0)
        : (item.nagdeviOfficeQty || 0);

    if (quantity > currentQty) {
      throw new Error(`Only ${currentQty} units available in ${sale.location} stock.`);
    }

    const updatedQuantities = {
      upper: item.upperOfficeQty || 0,
      down: item.downOfficeQty || 0,
      nagdevi: item.nagdeviOfficeQty || 0,
    };

    if (sale.location === 'upper') updatedQuantities.upper = Math.max(0, updatedQuantities.upper - quantity);
    if (sale.location === 'down') updatedQuantities.down = Math.max(0, updatedQuantities.down - quantity);
    if (sale.location === 'nagdevi') updatedQuantities.nagdevi = Math.max(0, updatedQuantities.nagdevi - quantity);

    const totalQuantity = updatedQuantities.upper + updatedQuantities.down + updatedQuantities.nagdevi;
    const salePayload: SaleRecord = {
      id: '',
      itemId: item.id,
      itemName: item.name,
      customerName: sale.customerName.trim(),
      companyName: sale.companyName.trim(),
      quantity,
      unitPrice: Number(sale.unitPrice) || 0,
      totalAmount: quantity * (Number(sale.unitPrice) || 0),
      location: sale.location,
      soldAt: sale.soldAt,
      notes: sale.notes?.trim() || '',
      ownerId: auth.currentUser.uid,
    };

    try {
      const saleRef = await addDoc(collection(db, SALES_COLLECTION), {
        ...salePayload,
        soldAt: sale.soldAt,
        ownerId: auth.currentUser.uid,
      });

      await updateDoc(doc(db, COLLECTION_PATH, item.id), {
        upperOfficeQty: updatedQuantities.upper,
        downOfficeQty: updatedQuantities.down,
        nagdeviOfficeQty: updatedQuantities.nagdevi,
        quantity: totalQuantity,
        updatedAt: serverTimestamp(),
      });

      salePayload.id = saleRef.id;

      const cachedSales = readLocalCache<SaleRecord>(SALES_CACHE_KEY);
      const existingIndex = cachedSales.findIndex(existing => existing.itemId === item.id && existing.customerName === sale.customerName && existing.companyName === sale.companyName && existing.quantity === sale.quantity && existing.soldAt?.seconds === sale.soldAt.getTime() / 1000);
      if (existingIndex === -1) {
        cachedSales.unshift({ ...salePayload, id: saleRef.id });
        writeLocalCache(SALES_CACHE_KEY, cachedSales);
      }

      logActivity('SALE', item.name, item.id, {
        before: {
          total: item.quantity,
          upper: item.upperOfficeQty,
          down: item.downOfficeQty,
          nagdevi: item.nagdeviOfficeQty,
        },
        after: {
          total: totalQuantity,
          upper: updatedQuantities.upper,
          down: updatedQuantities.down,
          nagdevi: updatedQuantities.nagdevi,
          sale: salePayload,
        }
      });
    } catch (error) {
      const cachedSales = readLocalCache<SaleRecord>(SALES_CACHE_KEY);
      const localSale: SaleRecord = {
        id: `local-${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        customerName: sale.customerName.trim(),
        companyName: sale.companyName.trim(),
        quantity: sale.quantity,
        unitPrice: Number(sale.unitPrice) || 0,
        totalAmount: sale.quantity * (Number(sale.unitPrice) || 0),
        location: sale.location,
        soldAt: sale.soldAt,
        notes: sale.notes?.trim() || '',
        ownerId: auth.currentUser.uid,
      };
      writeLocalCache(SALES_CACHE_KEY, [localSale, ...cachedSales]);

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        const updatedItem = { ...cachedItems[itemIndex] };
        if (sale.location === 'upper') updatedItem.upperOfficeQty = Math.max(0, (updatedItem.upperOfficeQty || 0) - sale.quantity);
        if (sale.location === 'down') updatedItem.downOfficeQty = Math.max(0, (updatedItem.downOfficeQty || 0) - sale.quantity);
        if (sale.location === 'nagdevi') updatedItem.nagdeviOfficeQty = Math.max(0, (updatedItem.nagdeviOfficeQty || 0) - sale.quantity);
        updatedItem.quantity = (updatedItem.upperOfficeQty || 0) + (updatedItem.downOfficeQty || 0) + (updatedItem.nagdeviOfficeQty || 0);
        cachedItems[itemIndex] = updatedItem;
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }

      console.warn('Firestore sale write failed, saved to local cache instead:', error);
    }
  },

  fetchPurchasesOnce: async (): Promise<PurchaseRecord[]> => {
    const cachedPurchases = readLocalCache<PurchaseRecord>(PURCHASES_CACHE_KEY);
    if (!auth.currentUser) return cachedPurchases;

    try {
      const q = query(
        collection(db, PURCHASES_COLLECTION),
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('purchasedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseRecord[];
      writeLocalCache(PURCHASES_CACHE_KEY, purchases);
      return purchases;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        console.warn('Purchases fetch quota exceeded, using local cache only:', error);
        return cachedPurchases;
      }
      console.warn('Purchases fetch failed, using local cache:', error);
      return cachedPurchases;
    }
  },

  recordPurchase: async (item: InventoryItem, purchase: {
    supplierName: string;
    boxPacking?: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
    purchasedAt: Date;
    notes?: string;
  }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const quantity = Number(purchase.quantity) || 0;
    if (quantity <= 0) {
      throw new Error('Purchase quantity must be greater than zero.');
    }

    const updatedQuantities = {
      upper: item.upperOfficeQty || 0,
      down: item.downOfficeQty || 0,
      nagdevi: item.nagdeviOfficeQty || 0,
    };

    if (purchase.location === 'upper') updatedQuantities.upper += quantity;
    if (purchase.location === 'down') updatedQuantities.down += quantity;
    if (purchase.location === 'nagdevi') updatedQuantities.nagdevi += quantity;

    const totalQuantity = updatedQuantities.upper + updatedQuantities.down + updatedQuantities.nagdevi;
    const targetBoxPacking = purchase.boxPacking?.trim().toUpperCase() || item.boxPacking || '';
    const purchasePayload: PurchaseRecord = {
      id: '',
      itemId: item.id,
      itemName: item.name,
      supplierName: purchase.supplierName.trim(),
      boxPacking: targetBoxPacking,
      quantity,
      unitPrice: Number(purchase.unitPrice) || 0,
      totalAmount: quantity * (Number(purchase.unitPrice) || 0),
      location: purchase.location,
      purchasedAt: purchase.purchasedAt,
      notes: purchase.notes?.trim() || '',
      ownerId: auth.currentUser.uid,
    };

    try {
      const purchaseRef = await addDoc(collection(db, PURCHASES_COLLECTION), {
        ...purchasePayload,
        purchasedAt: purchase.purchasedAt,
        ownerId: auth.currentUser.uid,
      });

      await updateDoc(doc(db, COLLECTION_PATH, item.id), {
        upperOfficeQty: updatedQuantities.upper,
        downOfficeQty: updatedQuantities.down,
        nagdeviOfficeQty: updatedQuantities.nagdevi,
        quantity: totalQuantity,
        updatedAt: serverTimestamp(),
      });

      purchasePayload.id = purchaseRef.id;
      const cachedPurchases = readLocalCache<PurchaseRecord>(PURCHASES_CACHE_KEY);
      cachedPurchases.unshift({ ...purchasePayload, id: purchaseRef.id });
      writeLocalCache(PURCHASES_CACHE_KEY, cachedPurchases);

      logActivity('PURCHASE', item.name, item.id, {
        before: {
          total: item.quantity,
          upper: item.upperOfficeQty,
          down: item.downOfficeQty,
          nagdevi: item.nagdeviOfficeQty,
        },
        after: {
          total: totalQuantity,
          upper: updatedQuantities.upper,
          down: updatedQuantities.down,
          nagdevi: updatedQuantities.nagdevi,
          purchase: purchasePayload,
        }
      });
    } catch (error) {
      const cachedPurchases = readLocalCache<PurchaseRecord>(PURCHASES_CACHE_KEY);
      const localPurchase: PurchaseRecord = {
        id: `local-${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        supplierName: purchase.supplierName.trim(),
        boxPacking: targetBoxPacking,
        quantity,
        unitPrice: Number(purchase.unitPrice) || 0,
        totalAmount: quantity * (Number(purchase.unitPrice) || 0),
        location: purchase.location,
        purchasedAt: purchase.purchasedAt,
        notes: purchase.notes?.trim() || '',
        ownerId: auth.currentUser.uid,
      };
      writeLocalCache(PURCHASES_CACHE_KEY, [localPurchase, ...cachedPurchases]);

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        const updatedItem = { ...cachedItems[itemIndex] };
        if (purchase.location === 'upper') updatedItem.upperOfficeQty = (updatedItem.upperOfficeQty || 0) + quantity;
        if (purchase.location === 'down') updatedItem.downOfficeQty = (updatedItem.downOfficeQty || 0) + quantity;
        if (purchase.location === 'nagdevi') updatedItem.nagdeviOfficeQty = (updatedItem.nagdeviOfficeQty || 0) + quantity;
        updatedItem.quantity = (updatedItem.upperOfficeQty || 0) + (updatedItem.downOfficeQty || 0) + (updatedItem.nagdeviOfficeQty || 0);
        cachedItems[itemIndex] = updatedItem;
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }

      console.warn('Firestore purchase write failed, saved to local cache instead:', error);
    }
  },

  fetchAuditLogsOnce: async (startDate?: Date, endDate?: Date): Promise<AuditLog[]> => {
    const cachedLogs = readLocalCache<AuditLog>(AUDIT_CACHE_KEY);
    if (!auth.currentUser) return cachedLogs;

    try {
      let q = query(
        collection(db, AUDIT_COLLECTION),
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(200)
      );

      if (startDate) {
        q = query(q, where('timestamp', '>=', startDate));
      }

      if (endDate) {
        q = query(q, where('timestamp', '<=', endDate));
      }

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[];
      writeLocalCache(AUDIT_CACHE_KEY, logs);
      return logs;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        console.warn('Audit log fetch quota exceeded, using local cache only:', error);
        return cachedLogs;
      }
      console.warn('Audit log fetch failed, using local cache:', error);
      return cachedLogs;
    }
  },

  subscribeToAuditLogs: (callback: (logs: AuditLog[]) => void, startDate?: Date, endDate?: Date) => {
    if (!auth.currentUser) return () => {};

    let q = query(
      collection(db, AUDIT_COLLECTION),
      where('ownerId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    if (startDate) {
      q = query(q, where('timestamp', '>=', startDate));
    }

    if (endDate) {
      q = query(q, where('timestamp', '<=', endDate));
    }

    const cachedLogs = readLocalCache<AuditLog>(AUDIT_CACHE_KEY);
    if (cachedLogs.length > 0) {
      callback(cachedLogs);
    }

    const key = `audit:${auth.currentUser.uid}:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'all'}`;
    return ensureSingleListener(key, () => onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[];
      writeLocalCache(AUDIT_CACHE_KEY, logs);
      callback(logs);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Audit log listener quota exceeded, using local cache only:', error);
        callback(readLocalCache<AuditLog>(AUDIT_CACHE_KEY));
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Audit log listener error, using local cache:', error);
      callback(readLocalCache<AuditLog>(AUDIT_CACHE_KEY));
    }), () => readLocalCache<AuditLog>(AUDIT_CACHE_KEY));
  },

  addItem: async (
    item: Omit<NewInventoryItem, 'ownerId' | 'updatedAt' | 'createdAt' | 'orderIndex'> & { orderIndex?: number },
    existingItems: InventoryItem[] = []
  ) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    try {
      let calculatedOrderIndex = item.orderIndex;

      if (calculatedOrderIndex === undefined) {
        calculatedOrderIndex = Date.now();

        if (existingItems.length > 0) {
          // Find alphabetical position among the elements list
          const sortedByName = [...existingItems].sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );

          const targetName = item.name.toUpperCase();
          const insertionIndex = sortedByName.findIndex(existingItem => 
            existingItem.name.localeCompare(targetName, undefined, { numeric: true, sensitivity: 'base' }) >= 0
          );

          if (insertionIndex === -1) {
            // Put at the very end of modern alphabetical scale
            const lastAlphaItem = sortedByName[sortedByName.length - 1];
            calculatedOrderIndex = (lastAlphaItem.orderIndex ?? Date.now()) + 1000;
          } else if (insertionIndex === 0) {
            // Put at the very beginning of alphabetical scale
            const firstAlphaItem = sortedByName[0];
            calculatedOrderIndex = (firstAlphaItem.orderIndex ?? Date.now()) - 1000;
          } else {
            // Sit exactly between previous and next items
            const prevItem = sortedByName[insertionIndex - 1];
            const nextItem = sortedByName[insertionIndex];
            calculatedOrderIndex = ((prevItem.orderIndex ?? Date.now()) + (nextItem.orderIndex ?? Date.now())) / 2;
          }
        }
      }

      // Remove orderIndex from spread to be safe, or let it override
      const { orderIndex: omitted, ...itemData } = item;

      // Define payload and filter out undefined properties
      const rawPayload = {
        ...itemData,
        ownerId: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        orderIndex: calculatedOrderIndex,
      };
      
      const payload: any = {};
      Object.keys(rawPayload).forEach(key => {
        const val = (rawPayload as any)[key];
        if (val !== undefined) {
          payload[key] = val;
        }
      });

      const docRef = await addDoc(collection(db, COLLECTION_PATH), payload);

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const newItem: InventoryItem = {
        ...item,
        id: docRef.id,
        quantity: item.quantity ?? 0,
        upperOfficeQty: item.upperOfficeQty ?? 0,
        downOfficeQty: item.downOfficeQty ?? 0,
        nagdeviOfficeQty: item.nagdeviOfficeQty ?? 0,
        ownerId: auth.currentUser.uid,
        orderIndex: calculatedOrderIndex,
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      } as InventoryItem;
      writeLocalCache(INVENTORY_CACHE_KEY, [newItem, ...cachedItems]);

      logActivity('CREATE', item.name, docRef.id, { after: item });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const fallbackItem: InventoryItem = {
        ...item,
        id: `local-${Date.now()}`,
        quantity: item.quantity ?? 0,
        upperOfficeQty: item.upperOfficeQty ?? 0,
        downOfficeQty: item.downOfficeQty ?? 0,
        nagdeviOfficeQty: item.nagdeviOfficeQty ?? 0,
        ownerId: auth.currentUser.uid,
        orderIndex: item.orderIndex ?? Date.now(),
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      } as InventoryItem;
      writeLocalCache(INVENTORY_CACHE_KEY, [fallbackItem, ...cachedItems]);
      console.warn('Firestore create failed, saved to local cache instead:', error);
    }
  },

  updateItem: async (item: InventoryItem, updates: { name: string, price: number, boxPacking?: string }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const docRef = doc(db, COLLECTION_PATH, item.id);
      
      const rawUpdates = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      
      const cleanedUpdates: any = {};
      Object.keys(rawUpdates).forEach(key => {
        const val = (rawUpdates as any)[key];
        if (val !== undefined) {
          cleanedUpdates[key] = val;
        }
      });

      await updateDoc(docRef, cleanedUpdates);

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = {
          ...cachedItems[itemIndex],
          ...item,
          name: updates.name,
          price: updates.price,
          boxPacking: updates.boxPacking ?? item.boxPacking ?? '',
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        };
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }

      logActivity('UPDATE', item.name, item.id, {
        before: { name: item.name, price: item.price, boxPacking: item.boxPacking || '' },
        after: updates
      });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = {
          ...cachedItems[itemIndex],
          ...item,
          name: updates.name,
          price: updates.price,
          boxPacking: updates.boxPacking ?? item.boxPacking ?? '',
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        };
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }
      console.warn('Firestore item update failed, saved to local cache instead:', error);
    }
  },

  updateQuantity: async (item: InventoryItem, quantities: { total: number, upper?: number, down?: number, nagdevi?: number }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    try {
      const docRef = doc(db, COLLECTION_PATH, item.id);
      const updates: any = {
        quantity: quantities.total,
        updatedAt: serverTimestamp(),
      };
      if (quantities.upper !== undefined) updates.upperOfficeQty = quantities.upper;
      if (quantities.down !== undefined) updates.downOfficeQty = quantities.down;
      if (quantities.nagdevi !== undefined) updates.nagdeviOfficeQty = quantities.nagdevi;

      await updateDoc(docRef, updates);

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = { ...cachedItems[itemIndex], ...item, ...(quantities as any), quantity: quantities.total };
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }

      logActivity('STOCK_ADJUST', item.name, item.id, {
        before: { 
          total: item.quantity, 
          upper: item.upperOfficeQty, 
          down: item.downOfficeQty, 
          nagdevi: item.nagdeviOfficeQty 
        },
        after: quantities
      });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      const nextItem: InventoryItem = {
        ...item,
        quantity: quantities.total,
        upperOfficeQty: quantities.upper ?? item.upperOfficeQty ?? 0,
        downOfficeQty: quantities.down ?? item.downOfficeQty ?? 0,
        nagdeviOfficeQty: quantities.nagdevi ?? item.nagdeviOfficeQty ?? 0,
      };
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = nextItem;
      } else {
        cachedItems.unshift(nextItem);
      }
      writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      console.warn('Firestore stock update failed, saved to local cache instead:', error);
    }
  },

  updateBoxPacking: async (item: InventoryItem, boxPacking: string) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const docRef = doc(db, COLLECTION_PATH, item.id);
      await updateDoc(docRef, {
        boxPacking,
        updatedAt: serverTimestamp(),
      });

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = { ...cachedItems[itemIndex], boxPacking, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } };
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }

      logActivity('UPDATE', item.name, item.id, {
        before: { boxPacking: item.boxPacking || '' },
        after: { boxPacking }
      });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = { ...cachedItems[itemIndex], boxPacking, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } };
        writeLocalCache(INVENTORY_CACHE_KEY, cachedItems);
      }
      console.warn('Firestore box packing update failed, saved to local cache instead:', error);
    }
  },

  deleteItem: async (item: InventoryItem) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const docRef = doc(db, COLLECTION_PATH, item.id);
      await deleteDoc(docRef);

      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      writeLocalCache(INVENTORY_CACHE_KEY, cachedItems.filter(existing => existing.id !== item.id));

      logActivity('DELETE', item.name, item.id, { before: item });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(INVENTORY_CACHE_KEY);
      writeLocalCache(INVENTORY_CACHE_KEY, cachedItems.filter(existing => existing.id !== item.id));
      console.warn('Firestore delete failed, removed from local cache instead:', error);
    }
  },

  deleteAllItems: async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const q = query(
        collection(db, COLLECTION_PATH)
      );
      
      const snapshot = await getDocs(q);
      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const doc of snapshot.docs) {
        currentBatch.delete(doc.ref);
        count++;
        if (count === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);
      await logActivity('BATCH_DELETE', 'ALL ITEMS', undefined, { before: `${snapshot.size} items removed` });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, COLLECTION_PATH);
    }
  },

  importItems: async (items: Omit<NewInventoryItem, 'ownerId' | 'updatedAt' | 'orderIndex'>[]) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const batches = [];
      const now = Date.now();
      for (let i = 0; i < items.length; i += 500) {
        const chunk = items.slice(i, i + 500);
        const batch = writeBatch(db);
        
        chunk.forEach((item, indexWithinChunk) => {
          const globalIndex = i + indexWithinChunk;
          const docRef = doc(collection(db, COLLECTION_PATH));
          batch.set(docRef, {
            ...item,
            ownerId: auth.currentUser!.uid,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            orderIndex: now + globalIndex,
          });
        });
        
        batches.push(batch.commit());
      }
      
      await Promise.all(batches);
      await logActivity('BATCH_IMPORT', 'IMPORT SESSION', undefined, { after: `${items.length} items imported` });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_PATH);
    }
  }
};
