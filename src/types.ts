export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  quantity: number; // Total quantity (sum of all offices)
  upperOfficeQty: number;
  downOfficeQty: number;
  nagdeviOfficeQty: number;
  updatedAt: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  ownerId: string;
  orderIndex: number;
  boxPacking?: string;
  category?: string;
}

export type NewInventoryItem = Omit<InventoryItem, 'id'>;

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STOCK_ADJUST' | 'BATCH_IMPORT' | 'BATCH_DELETE' | 'SALE' | 'PURCHASE';

export type SaleLocation = 'upper' | 'down' | 'nagdevi';

export interface SaleRecord {
  id: string;
  itemId: string;
  itemName: string;
  customerName: string;
  companyName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  location: SaleLocation;
  soldAt: any;
  notes?: string;
  ownerId: string;
}

export interface PurchaseRecord {
  id: string;
  itemId: string;
  itemName: string;
  supplierName: string;
  boxPacking?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  location: SaleLocation;
  purchasedAt: any;
  notes?: string;
  ownerId: string;
}

export interface AuditLog {
  id: string;
  itemId?: string;
  itemName: string;
  action: AuditAction;
  changes?: {
    before?: any;
    after?: any;
  };
  timestamp: any;
  performedBy: string;
  performedByEmail: string;
}

export interface ReconciliationReport {
  timestamp: string;
  beforeCount: number;
  afterCount: number;
  beforeTotalQty: number;
  afterTotalQty: number;
  exactMatchesCount: number;
  newItems: string[];
  missingItems: string[];
  changedItems: {
    name: string;
    beforeQty: number;
    afterQty: number;
    beforePrice: number;
    afterPrice: number;
  }[];
}
