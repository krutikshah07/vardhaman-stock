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
  setDoc,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../lib/firebase';
import { InventoryItem, NewInventoryItem, AuditLog, AuditAction, SaleRecord, PurchaseRecord, SaleLocation, ReconciliationReport } from '../types';

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
const projectCacheSuffix = (firebaseConfig.projectId || 'default-project').replace(/[^a-zA-Z0-9_-]/g, '_');

const getUserCacheKey = (baseKey: string, userId?: string) => `${baseKey}:${projectCacheSuffix}:${userId ?? 'anonymous'}`;

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
    if (!value || value.length === 0) return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write local cache for ${key}:`, error);
  }
};

let quotaExceededState = false;
const quotaListeners = new Set<(isExceeded: boolean) => void>();

export const getIsQuotaExceeded = () => quotaExceededState;

export const subscribeToQuotaExceeded = (cb: (isExceeded: boolean) => void) => {
  quotaListeners.add(cb);
  cb(quotaExceededState);
  return () => quotaListeners.delete(cb);
};

const setQuotaExceeded = (exceeded: boolean) => {
  if (quotaExceededState !== exceeded) {
    quotaExceededState = exceeded;
    quotaListeners.forEach(cb => {
      try { cb(exceeded); } catch (_) {}
    });
  }
};

const isQuotaExceededError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: string }).code;
  const maybeMessage = (error as { message?: string }).message || '';
  const isExceeded = maybeCode === 'resource-exhausted' || maybeCode === 'quota-exceeded' || maybeMessage.toLowerCase().includes('quota exceeded');
  if (isExceeded) {
    setQuotaExceeded(true);
  }
  return isExceeded;
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
  const userEmail = auth.currentUser.email || '';
  const userDisplay = auth.currentUser.displayName || (userEmail ? userEmail.split('@')[0].toUpperCase() : 'ADMIN');
  try {
    await addDoc(collection(db, AUDIT_COLLECTION), {
      action,
      itemName,
      itemId: itemId || null,
      changes: changes || null,
      timestamp: serverTimestamp(),
      performedBy: userDisplay,
      performedByEmail: userEmail,
      ownerId: auth.currentUser.uid // For security rules / filtering
    });
  } catch (error) {
    console.warn('Failed to log audit activity:', error);
  }
};

export const inventoryService = {
  subscribeToInventory: (callback: (items: InventoryItem[]) => void) => {
    if (!auth.currentUser) return () => {};

    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);

    const q = query(
      collection(db, COLLECTION_PATH)
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

      writeLocalCache(inventoryCacheKey, items);
      callback(items);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Inventory listener quota exceeded, using local cache only:', error);
        const cached = readLocalCache<InventoryItem>(inventoryCacheKey);
        if (cached.length > 0) {
          callback(cached);
        }
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Inventory listener error, using local cache:', error);
      const cached = readLocalCache<InventoryItem>(inventoryCacheKey);
      if (cached.length > 0) {
        callback(cached);
      }
    }), () => readLocalCache<InventoryItem>(inventoryCacheKey));
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
    if (!auth.currentUser) return [];

    const salesCacheKey = getUserCacheKey(SALES_CACHE_KEY, auth.currentUser.uid);
    const cachedSales = readLocalCache<SaleRecord>(salesCacheKey);

    try {
      const q = query(
        collection(db, SALES_COLLECTION),
        orderBy('soldAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const sales = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SaleRecord[];
      writeLocalCache(salesCacheKey, sales);
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

    const salesCacheKey = getUserCacheKey(SALES_CACHE_KEY, auth.currentUser.uid);

    const q = query(
      collection(db, SALES_COLLECTION),
      orderBy('soldAt', 'desc')
    );

    const key = `sales:${auth.currentUser.uid}`;
    return ensureSingleListener(key, () => onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SaleRecord[];
      writeLocalCache(salesCacheKey, sales);
      callback(sales);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Sales listener quota exceeded, using local cache only:', error);
        const cached = readLocalCache<SaleRecord>(salesCacheKey);
        if (cached.length > 0) {
          callback(cached);
        }
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Sales listener error, using local cache:', error);
      const cached = readLocalCache<SaleRecord>(salesCacheKey);
      if (cached.length > 0) {
        callback(cached);
      }
    }), () => readLocalCache<SaleRecord>(salesCacheKey));
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

    const salesCacheKey = getUserCacheKey(SALES_CACHE_KEY, auth.currentUser.uid);
    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
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
    const saleData = {
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
        ...saleData,
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

      const salePayload: SaleRecord = {
        ...saleData,
        id: saleRef.id,
      };

      const cachedSales = readLocalCache<SaleRecord>(salesCacheKey);
      const existingIndex = cachedSales.findIndex(existing => existing.itemId === item.id && existing.customerName === sale.customerName && existing.companyName === sale.companyName && existing.quantity === sale.quantity && existing.soldAt?.seconds === sale.soldAt.getTime() / 1000);
      if (existingIndex === -1) {
        cachedSales.unshift({ ...salePayload, id: saleRef.id });
        writeLocalCache(salesCacheKey, cachedSales);
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
      const cachedSales = readLocalCache<SaleRecord>(salesCacheKey);
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
      writeLocalCache(salesCacheKey, [localSale, ...cachedSales]);

      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        const updatedItem = { ...cachedItems[itemIndex] };
        if (sale.location === 'upper') updatedItem.upperOfficeQty = Math.max(0, (updatedItem.upperOfficeQty || 0) - sale.quantity);
        if (sale.location === 'down') updatedItem.downOfficeQty = Math.max(0, (updatedItem.downOfficeQty || 0) - sale.quantity);
        if (sale.location === 'nagdevi') updatedItem.nagdeviOfficeQty = Math.max(0, (updatedItem.nagdeviOfficeQty || 0) - sale.quantity);
        updatedItem.quantity = (updatedItem.upperOfficeQty || 0) + (updatedItem.downOfficeQty || 0) + (updatedItem.nagdeviOfficeQty || 0);
        cachedItems[itemIndex] = updatedItem;
        writeLocalCache(inventoryCacheKey, cachedItems);
      }

      console.warn('Firestore sale write failed, saved to local cache instead:', error);
    }
  },

  fetchPurchasesOnce: async (): Promise<PurchaseRecord[]> => {
    if (!auth.currentUser) return [];

    const purchasesCacheKey = getUserCacheKey(PURCHASES_CACHE_KEY, auth.currentUser.uid);
    const cachedPurchases = readLocalCache<PurchaseRecord>(purchasesCacheKey);

    try {
      const q = query(
        collection(db, PURCHASES_COLLECTION),
        orderBy('purchasedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const purchases = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PurchaseRecord[];
      writeLocalCache(purchasesCacheKey, purchases);
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

  subscribeToPurchases: (callback: (purchases: PurchaseRecord[]) => void) => {
    if (!auth.currentUser) return () => {};

    const purchasesCacheKey = getUserCacheKey(PURCHASES_CACHE_KEY, auth.currentUser.uid);

    const q = query(
      collection(db, PURCHASES_COLLECTION),
      orderBy('purchasedAt', 'desc')
    );

    const key = `purchases:${auth.currentUser.uid}`;
    return ensureSingleListener(key, () => onSnapshot(q, (snapshot) => {
      const purchases = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PurchaseRecord[];
      writeLocalCache(purchasesCacheKey, purchases);
      callback(purchases);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Purchases listener quota exceeded, using local cache only:', error);
        const cached = readLocalCache<PurchaseRecord>(purchasesCacheKey);
        if (cached.length > 0) {
          callback(cached);
        }
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Purchases listener error, using local cache:', error);
      const cached = readLocalCache<PurchaseRecord>(purchasesCacheKey);
      if (cached.length > 0) {
        callback(cached);
      }
    }), () => readLocalCache<PurchaseRecord>(purchasesCacheKey));
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

    const purchasesCacheKey = getUserCacheKey(PURCHASES_CACHE_KEY, auth.currentUser.uid);
    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
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
    const purchaseData = {
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

    const newPrice = Number(purchase.unitPrice) || 0;

    try {
      const purchaseRef = await addDoc(collection(db, PURCHASES_COLLECTION), {
        ...purchaseData,
        purchasedAt: purchase.purchasedAt,
        ownerId: auth.currentUser.uid,
      });

      const updatePayload: any = {
        upperOfficeQty: updatedQuantities.upper,
        downOfficeQty: updatedQuantities.down,
        nagdeviOfficeQty: updatedQuantities.nagdevi,
        quantity: totalQuantity,
        updatedAt: serverTimestamp(),
      };
      if (newPrice > 0) {
        updatePayload.price = newPrice;
      }
      if (targetBoxPacking) {
        updatePayload.boxPacking = targetBoxPacking;
      }

      await updateDoc(doc(db, COLLECTION_PATH, item.id), updatePayload);

      const purchaseRecord: PurchaseRecord = {
        ...purchaseData,
        id: purchaseRef.id,
      };
      const cachedPurchases = readLocalCache<PurchaseRecord>(purchasesCacheKey);
      cachedPurchases.unshift(purchaseRecord);
      writeLocalCache(purchasesCacheKey, cachedPurchases);

      logActivity('PURCHASE', item.name, item.id, {
        before: {
          price: item.price,
          total: item.quantity,
          upper: item.upperOfficeQty,
          down: item.downOfficeQty,
          nagdevi: item.nagdeviOfficeQty,
        },
        after: {
          price: newPrice > 0 ? newPrice : item.price,
          total: totalQuantity,
          upper: updatedQuantities.upper,
          down: updatedQuantities.down,
          nagdevi: updatedQuantities.nagdevi,
          purchase: purchaseRecord,
        }
      });
    } catch (error) {
      const cachedPurchases = readLocalCache<PurchaseRecord>(purchasesCacheKey);
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
      writeLocalCache(purchasesCacheKey, [localPurchase, ...cachedPurchases]);

      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        const updatedItem = { ...cachedItems[itemIndex] };
        if (newPrice > 0) updatedItem.price = newPrice;
        if (targetBoxPacking) updatedItem.boxPacking = targetBoxPacking;
        if (purchase.location === 'upper') updatedItem.upperOfficeQty = (updatedItem.upperOfficeQty || 0) + quantity;
        if (purchase.location === 'down') updatedItem.downOfficeQty = (updatedItem.downOfficeQty || 0) + quantity;
        if (purchase.location === 'nagdevi') updatedItem.nagdeviOfficeQty = (updatedItem.nagdeviOfficeQty || 0) + quantity;
        updatedItem.quantity = (updatedItem.upperOfficeQty || 0) + (updatedItem.downOfficeQty || 0) + (updatedItem.nagdeviOfficeQty || 0);
        cachedItems[itemIndex] = updatedItem;
        writeLocalCache(inventoryCacheKey, cachedItems);
      }

      console.warn('Firestore purchase write failed, saved to local cache instead:', error);
    }
  },

  deleteSale: async (saleId: string) => {
    if (!auth.currentUser) return;
    if (!saleId || typeof saleId !== 'string' || !saleId.trim()) {
      throw new Error('Invalid saleId provided for deletion.');
    }
    const cleanId = saleId.trim();
    try {
      const salesCacheKey = getUserCacheKey(SALES_CACHE_KEY, auth.currentUser.uid);
      const cachedSales = readLocalCache<SaleRecord>(salesCacheKey);
      writeLocalCache(salesCacheKey, cachedSales.filter(s => s.id !== cleanId));

      await deleteDoc(doc(db, SALES_COLLECTION, cleanId));
      logActivity('DELETE', `Sale Record (${cleanId})`, undefined, { after: 'Deleted sale record' });
    } catch (error) {
      console.warn('Failed to delete sale record:', error);
      throw error;
    }
  },

  deletePurchase: async (purchaseId: string) => {
    if (!auth.currentUser) return;
    if (!purchaseId || typeof purchaseId !== 'string' || !purchaseId.trim()) {
      throw new Error('Invalid purchaseId provided for deletion.');
    }
    const cleanId = purchaseId.trim();
    try {
      const purchasesCacheKey = getUserCacheKey(PURCHASES_CACHE_KEY, auth.currentUser.uid);
      const cachedPurchases = readLocalCache<PurchaseRecord>(purchasesCacheKey);
      writeLocalCache(purchasesCacheKey, cachedPurchases.filter(p => p.id !== cleanId));

      await deleteDoc(doc(db, PURCHASES_COLLECTION, cleanId));
      logActivity('DELETE', `Purchase Record (${cleanId})`, undefined, { after: 'Deleted purchase record' });
    } catch (error) {
      console.warn('Failed to delete purchase record:', error);
      throw error;
    }
  },

  updateSale: async (saleId: string, updates: {
    customerName: string;
    companyName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
  }) => {
    if (!auth.currentUser) return;
    if (!saleId || typeof saleId !== 'string' || !saleId.trim()) {
      throw new Error('Invalid saleId provided for update.');
    }
    const cleanId = saleId.trim();
    try {
      const totalAmount = updates.quantity * updates.unitPrice;
      const salesCacheKey = getUserCacheKey(SALES_CACHE_KEY, auth.currentUser.uid);
      const cachedSales = readLocalCache<SaleRecord>(salesCacheKey);
      writeLocalCache(salesCacheKey, cachedSales.map(s => s.id === cleanId ? {
        ...s,
        customerName: updates.customerName.trim(),
        companyName: updates.companyName.trim(),
        quantity: updates.quantity,
        unitPrice: updates.unitPrice,
        totalAmount,
        location: updates.location,
      } : s));

      await updateDoc(doc(db, SALES_COLLECTION, cleanId), {
        customerName: updates.customerName.trim(),
        companyName: updates.companyName.trim(),
        quantity: updates.quantity,
        unitPrice: updates.unitPrice,
        totalAmount,
        location: updates.location,
      });

      logActivity('UPDATE', `Sale Record (${cleanId})`, undefined, {
        after: `Customer: ${updates.customerName} | Company: ${updates.companyName} | Qty: ${updates.quantity} | Price: ₹${updates.unitPrice} | Loc: ${updates.location}`
      });
    } catch (error) {
      console.warn('Failed to update sale record:', error);
      throw error;
    }
  },

  updatePurchase: async (purchaseId: string, updates: {
    supplierName: string;
    quantity: number;
    unitPrice: number;
    location: SaleLocation;
  }) => {
    if (!auth.currentUser) return;
    if (!purchaseId || typeof purchaseId !== 'string' || !purchaseId.trim()) {
      throw new Error('Invalid purchaseId provided for update.');
    }
    const cleanId = purchaseId.trim();
    try {
      const totalAmount = updates.quantity * updates.unitPrice;
      const purchasesCacheKey = getUserCacheKey(PURCHASES_CACHE_KEY, auth.currentUser.uid);
      const cachedPurchases = readLocalCache<PurchaseRecord>(purchasesCacheKey);
      writeLocalCache(purchasesCacheKey, cachedPurchases.map(p => p.id === cleanId ? {
        ...p,
        supplierName: updates.supplierName.trim(),
        quantity: updates.quantity,
        unitPrice: updates.unitPrice,
        totalAmount,
        location: updates.location,
      } : p));

      await updateDoc(doc(db, PURCHASES_COLLECTION, cleanId), {
        supplierName: updates.supplierName.trim(),
        quantity: updates.quantity,
        unitPrice: updates.unitPrice,
        totalAmount,
        location: updates.location,
      });

      logActivity('UPDATE', `Purchase Record (${cleanId})`, undefined, {
        after: `Supplier: ${updates.supplierName} | Qty: ${updates.quantity} | Price: ₹${updates.unitPrice} | Loc: ${updates.location}`
      });
    } catch (error) {
      console.warn('Failed to update purchase record:', error);
      throw error;
    }
  },

  getCustomerSuggestions: async (): Promise<{ customers: string[]; companies: string[] }> => {
    try {
      const sales = await inventoryService.fetchSalesOnce();
      const customerSet = new Set<string>();
      const companySet = new Set<string>();

      sales.forEach((s) => {
        if (s.customerName && s.customerName.trim()) {
          customerSet.add(s.customerName.trim().toUpperCase());
        }
        if (s.companyName && s.companyName.trim()) {
          companySet.add(s.companyName.trim().toUpperCase());
        }
      });

      return {
        customers: Array.from(customerSet).sort(),
        companies: Array.from(companySet).sort(),
      };
    } catch (error) {
      console.warn('Failed to get customer suggestions:', error);
      return { customers: [], companies: [] };
    }
  },

  getSupplierSuggestions: async (): Promise<string[]> => {
    try {
      const purchases = await inventoryService.fetchPurchasesOnce();
      const supplierSet = new Set<string>();

      purchases.forEach((p) => {
        if (p.supplierName && p.supplierName.trim()) {
          supplierSet.add(p.supplierName.trim().toUpperCase());
        }
      });

      return Array.from(supplierSet).sort();
    } catch (error) {
      console.warn('Failed to get supplier suggestions:', error);
      return [];
    }
  },

  // 1. Full database export to a downloadable JSON file
  exportAllDataToJSON: async () => {
    try {
      const [inventorySnap, salesSnap, purchasesSnap, auditSnap] = await Promise.all([
        getDocs(collection(db, COLLECTION_PATH)),
        getDocs(collection(db, SALES_COLLECTION)),
        getDocs(collection(db, PURCHASES_COLLECTION)),
        getDocs(collection(db, AUDIT_COLLECTION)),
      ]);

      const backupData = {
        exportedAt: new Date().toISOString(),
        projectId: firebaseConfig.projectId,
        counts: {
          inventory: inventorySnap.size,
          sales: salesSnap.size,
          purchases: purchasesSnap.size,
          audit_logs: auditSnap.size,
        },
        inventory: inventorySnap.docs.map(d => ({ ...d.data(), id: d.id })),
        sales: salesSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        purchases: purchasesSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        audit_logs: auditSnap.docs.map(d => ({ ...d.data(), id: d.id })),
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `vardhaman_stock_backup_${dateStr}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return backupData;
    } catch (error) {
      console.error('Failed to export full database backup:', error);
      throw error;
    }
  },

  // 2. Clone all documents to a secure backup collection inside Firestore (e.g. inventory_backup_YYYYMMDD)
  backupAllDataToFirestoreCollection: async () => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const backupCollectionName = `inventory_backup_${dateStr}`;

      const snapshot = await getDocs(collection(db, COLLECTION_PATH));
      if (snapshot.empty) return { count: 0, targetCollection: backupCollectionName };

      const batches = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const docSnap of snapshot.docs) {
        const targetRef = doc(db, backupCollectionName, docSnap.id);
        currentBatch.set(targetRef, {
          ...docSnap.data(),
          _backedUpAt: serverTimestamp(),
          _originalId: docSnap.id,
        });
        count++;

        if (count % 400 === 0) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
        }
      }

      batches.push(currentBatch.commit());
      await Promise.all(batches);

      await logActivity('BATCH_IMPORT', `Backup Created (${backupCollectionName})`, undefined, {
        after: `Saved ${count} items to Firestore collection ${backupCollectionName}`
      });

      return { count, targetCollection: backupCollectionName };
    } catch (error) {
      console.error('Failed to clone database to Firestore backup collection:', error);
      throw error;
    }
  },

  // 3. Reconcile Live Inventory against a Baseline Snapshot (or uploaded list)
  reconcileInventory: (
    beforeItems: Array<{ name: string; quantity?: number; price?: number }>,
    afterItems: Array<{ name: string; quantity?: number; price?: number }>
  ): ReconciliationReport => {
    const beforeMap = new Map<string, { qty: number; price: number }>();
    let beforeTotalQty = 0;
    beforeItems.forEach(item => {
      const cleanName = String(item.name || '').trim().toUpperCase();
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      beforeMap.set(cleanName, { qty, price });
      beforeTotalQty += qty;
    });

    const afterMap = new Map<string, { qty: number; price: number }>();
    let afterTotalQty = 0;
    afterItems.forEach(item => {
      const cleanName = String(item.name || '').trim().toUpperCase();
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      afterMap.set(cleanName, { qty, price });
      afterTotalQty += qty;
    });

    let exactMatchesCount = 0;
    const newItems: string[] = [];
    const missingItems: string[] = [];
    const changedItems: Array<{
      name: string;
      beforeQty: number;
      afterQty: number;
      beforePrice: number;
      afterPrice: number;
    }> = [];

    // Check all afterItems
    afterMap.forEach((afterVal, name) => {
      if (!beforeMap.has(name)) {
        newItems.push(name);
      } else {
        const beforeVal = beforeMap.get(name)!;
        if (beforeVal.qty === afterVal.qty && beforeVal.price === afterVal.price) {
          exactMatchesCount++;
        } else {
          changedItems.push({
            name,
            beforeQty: beforeVal.qty,
            afterQty: afterVal.qty,
            beforePrice: beforeVal.price,
            afterPrice: afterVal.price,
          });
        }
      }
    });

    // Check for items missing in afterItems
    beforeMap.forEach((_, name) => {
      if (!afterMap.has(name)) {
        missingItems.push(name);
      }
    });

    return {
      timestamp: new Date().toISOString(),
      beforeCount: beforeItems.length,
      afterCount: afterItems.length,
      beforeTotalQty,
      afterTotalQty,
      exactMatchesCount,
      newItems,
      missingItems,
      changedItems,
    };
  },

  fetchAuditLogsOnce: async (startDate?: Date, endDate?: Date, limitCount: number = 500): Promise<AuditLog[]> => {
    if (!auth.currentUser) return [];

    const auditCacheKey = getUserCacheKey(AUDIT_CACHE_KEY, auth.currentUser.uid);
    const cachedLogs = readLocalCache<AuditLog>(auditCacheKey);

    try {
      let q = query(
        collection(db, AUDIT_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
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
      writeLocalCache(auditCacheKey, logs);
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

  subscribeToAuditLogs: (callback: (logs: AuditLog[]) => void, startDate?: Date, endDate?: Date, limitCount: number = 500) => {
    if (!auth.currentUser) return () => {};

    const auditCacheKey = getUserCacheKey(AUDIT_CACHE_KEY, auth.currentUser.uid);

    let q = query(
      collection(db, AUDIT_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (startDate) {
      q = query(q, where('timestamp', '>=', startDate));
    }

    if (endDate) {
      q = query(q, where('timestamp', '<=', endDate));
    }

    const cachedLogs = readLocalCache<AuditLog>(auditCacheKey);
    if (cachedLogs.length > 0) {
      callback(cachedLogs);
    }

    const key = `audit:${auth.currentUser.uid}:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'all'}`;
    return ensureSingleListener(key, () => onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[];
      writeLocalCache(auditCacheKey, logs);
      callback(logs);
    }, (error) => {
      if (isQuotaExceededError(error)) {
        console.warn('Audit log listener quota exceeded, using local cache only:', error);
        const cached = readLocalCache<AuditLog>(auditCacheKey);
        if (cached.length > 0) {
          callback(cached);
        }
        const current = listenerRegistry.get(key);
        if (current) {
          current();
          listenerRegistry.delete(key);
        }
        return;
      }
      console.warn('Audit log listener error, using local cache:', error);
      const cached = readLocalCache<AuditLog>(auditCacheKey);
      if (cached.length > 0) {
        callback(cached);
      }
    }), () => readLocalCache<AuditLog>(auditCacheKey));
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

      const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
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
      writeLocalCache(inventoryCacheKey, [newItem, ...cachedItems]);

      logActivity('CREATE', item.name, docRef.id, { after: item });
    } catch (error) {
      const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
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
      writeLocalCache(inventoryCacheKey, [fallbackItem, ...cachedItems]);
      console.warn('Firestore create failed, saved to local cache instead:', error);
    }
  },

  updateItem: async (item: InventoryItem, updates: { name: string, price: number, boxPacking?: string, category?: string }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
    
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

      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = {
          ...cachedItems[itemIndex],
          ...item,
          name: updates.name,
          price: updates.price,
          boxPacking: updates.boxPacking ?? item.boxPacking ?? '',
          category: updates.category ?? item.category ?? '',
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        };
        writeLocalCache(inventoryCacheKey, cachedItems);
      }

      logActivity('UPDATE', item.name, item.id, {
        before: { name: item.name, price: item.price, boxPacking: item.boxPacking || '', category: item.category || '' },
        after: updates
      });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = {
          ...cachedItems[itemIndex],
          ...item,
          name: updates.name,
          price: updates.price,
          boxPacking: updates.boxPacking ?? item.boxPacking ?? '',
          category: updates.category ?? item.category ?? '',
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        };
        writeLocalCache(inventoryCacheKey, cachedItems);
      }
      console.warn('Firestore item update failed, saved to local cache instead:', error);
    }
  },

  updateQuantity: async (item: InventoryItem, quantities: { total: number, upper?: number, down?: number, nagdevi?: number }) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);

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

      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = { ...cachedItems[itemIndex], ...item, ...(quantities as any), quantity: quantities.total };
        writeLocalCache(inventoryCacheKey, cachedItems);
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
      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
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
      writeLocalCache(inventoryCacheKey, cachedItems);
      console.warn('Firestore stock update failed, saved to local cache instead:', error);
    }
  },

  updateBoxPacking: async (item: InventoryItem, boxPacking: string) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
    
    try {
      const docRef = doc(db, COLLECTION_PATH, item.id);
      await updateDoc(docRef, {
        boxPacking,
        updatedAt: serverTimestamp(),
      });

      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = { ...cachedItems[itemIndex], boxPacking, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } };
        writeLocalCache(inventoryCacheKey, cachedItems);
      }

      logActivity('UPDATE', item.name, item.id, {
        before: { boxPacking: item.boxPacking || '' },
        after: { boxPacking }
      });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      const itemIndex = cachedItems.findIndex(existing => existing.id === item.id);
      if (itemIndex >= 0) {
        cachedItems[itemIndex] = { ...cachedItems[itemIndex], boxPacking, updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } };
        writeLocalCache(inventoryCacheKey, cachedItems);
      }
      console.warn('Firestore box packing update failed, saved to local cache instead:', error);
    }
  },

  deleteItem: async (item: InventoryItem) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const inventoryCacheKey = getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid);
    
    try {
      const docRef = doc(db, COLLECTION_PATH, item.id);
      await deleteDoc(docRef);

      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      writeLocalCache(inventoryCacheKey, cachedItems.filter(existing => existing.id !== item.id));

      logActivity('DELETE', item.name, item.id, { before: item });
    } catch (error) {
      const cachedItems = readLocalCache<InventoryItem>(inventoryCacheKey);
      writeLocalCache(inventoryCacheKey, cachedItems.filter(existing => existing.id !== item.id));
      console.warn('Firestore delete failed, removed from local cache instead:', error);
    }
  },

  deleteAllItems: async (onProgress?: (deleted: number, total: number) => void) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      const q = query(
        collection(db, COLLECTION_PATH)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const total = snapshot.size;
      const batches: any[] = [];
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const doc of snapshot.docs) {
        currentBatch.delete(doc.ref);
        count++;
        if (count === 500) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        batches.push(currentBatch);
      }
      
      // Execute batches sequentially with main thread yield to prevent browser UI freeze
      let deletedCount = 0;
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        deletedCount = Math.min((i + 1) * 500, total);
        if (onProgress) {
          onProgress(deletedCount, total);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await logActivity('BATCH_DELETE', 'ALL ITEMS', undefined, { before: `${snapshot.size} items removed` });
      try {
        localStorage.removeItem(getUserCacheKey(INVENTORY_CACHE_KEY, auth.currentUser.uid));
      } catch (_) {}
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, COLLECTION_PATH);
    }
  },

  importItems: async (
    items: (Omit<NewInventoryItem, 'ownerId' | 'updatedAt' | 'orderIndex'> & { updatedAt?: any; createdAt?: any; orderIndex?: number })[],
    onProgress?: (current: number, total: number) => void
  ) => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    try {
      // 1. Fetch current existing items to preserve their exact original 'updatedAt' and 'createdAt' timestamps if matching
      const existingSnap = await getDocs(collection(db, COLLECTION_PATH));
      const existingDatesMap = new Map<string, { updatedAt: any; createdAt: any }>();
      existingSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name) {
          existingDatesMap.set(String(data.name).trim().toUpperCase(), {
            updatedAt: data.updatedAt,
            createdAt: data.createdAt,
          });
        }
      });

      const totalItems = items.length;
      // 2. Commit in chunks of 500 sequentially to keep browser thread completely responsive
      for (let i = 0; i < totalItems; i += 500) {
        const chunk = items.slice(i, i + 500);
        const batch = writeBatch(db);
        
        chunk.forEach((item, indexWithinChunk) => {
          const globalIndex = i + indexWithinChunk;
          const docRef = doc(collection(db, COLLECTION_PATH));
          const cleanName = String(item.name || '').trim().toUpperCase();
          const existingDates = existingDatesMap.get(cleanName);

          const rawItem: any = {
            name: cleanName,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            upperOfficeQty: Number(item.upperOfficeQty) || 0,
            downOfficeQty: Number(item.downOfficeQty) || 0,
            nagdeviOfficeQty: Number(item.nagdeviOfficeQty) || 0,
            ownerId: auth.currentUser!.uid,
            // Preserve exact row sequence order from spreadsheet
            orderIndex: item.orderIndex !== undefined ? item.orderIndex : (globalIndex + 1) * 100,
            // Preserve explicit updatedAt from file (or existing doc date or server timestamp)
            updatedAt: item.updatedAt || existingDates?.updatedAt || serverTimestamp(),
            createdAt: item.createdAt || existingDates?.createdAt || serverTimestamp(),
          };

          if (item.boxPacking && String(item.boxPacking).trim()) {
            rawItem.boxPacking = String(item.boxPacking).trim().toUpperCase();
          }
          if (item.category && String(item.category).trim()) {
            rawItem.category = String(item.category).trim().toUpperCase();
          }

          batch.set(docRef, rawItem);
        });
        
        await batch.commit();
        if (onProgress) {
          onProgress(Math.min(i + 500, totalItems), totalItems);
        }
        // Yield to browser event loop
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      
      await logActivity('BATCH_IMPORT', 'IMPORT SESSION', undefined, { after: `${items.length} items imported` });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_PATH);
    }
  }
};
