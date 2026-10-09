import { supabase } from '../lib/supabase';
import { InventoryItem, NewInventoryItem, AuditLog, AuditAction, SaleRecord, PurchaseRecord, SaleLocation } from '../types';

export const supabaseService = {
  // Convert Supabase DB row to InventoryItem
  mapRowToItem: (row: any): InventoryItem => ({
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    quantity: Number(row.quantity) || 0,
    upperOfficeQty: Number(row.upper_office_qty) || 0,
    downOfficeQty: Number(row.down_office_qty) || 0,
    nagdeviOfficeQty: Number(row.nagdevi_office_qty) || 0,
    boxPacking: row.box_packing || undefined,
    category: row.category || undefined,
    orderIndex: Number(row.order_index) || 0,
    ownerId: row.owner_id || 'system',
    createdAt: row.created_at ? { seconds: Math.floor(new Date(row.created_at).getTime() / 1000) } : null,
    updatedAt: row.updated_at ? { seconds: Math.floor(new Date(row.updated_at).getTime() / 1000) } : null,
  }),

  // Convert InventoryItem to Supabase DB row
  mapItemToRow: (item: any) => ({
    id: item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: String(item.name || '').trim().toUpperCase(),
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 0,
    upper_office_qty: Number(item.upperOfficeQty) || 0,
    down_office_qty: Number(item.downOfficeQty) || 0,
    nagdevi_office_qty: Number(item.nagdeviOfficeQty) || 0,
    box_packing: item.boxPacking ? String(item.boxPacking).trim().toUpperCase() : null,
    category: item.category ? String(item.category).trim().toUpperCase() : null,
    order_index: item.orderIndex !== undefined ? Number(item.orderIndex) : 0,
    owner_id: item.ownerId || 'system',
    updated_at: new Date().toISOString(),
  }),

  // Fetch all inventory items (paginated to bypass Supabase 1000 limit)
  fetchInventory: async (): Promise<InventoryItem[]> => {
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('order_index', { ascending: true })
        .range(from, from + step - 1);

      if (error) {
        console.error('Supabase fetchInventory error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }

    return allRows.map(supabaseService.mapRowToItem);
  },

  // Realtime subscription for inventory
  subscribeToInventory: (callback: (items: InventoryItem[]) => void) => {
    // Initial fetch
    supabaseService.fetchInventory().then(callback).catch(err => console.warn('Supabase initial fetch failed:', err));

    const channel = supabase
      .channel('public:inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => {
          // Re-fetch sorted list upon changes
          supabaseService.fetchInventory().then(callback).catch(console.warn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Add a single item
  addItem: async (item: any) => {
    const row = supabaseService.mapItemToRow(item);
    const { data, error } = await supabase.from('inventory').insert(row).select().single();
    if (error) throw error;
    return supabaseService.mapRowToItem(data);
  },

  // Update quantities
  updateStock: async (id: string, quantities: { upper: number; down: number; nagdevi: number; total: number }) => {
    const { error } = await supabase
      .from('inventory')
      .update({
        upper_office_qty: quantities.upper,
        down_office_qty: quantities.down,
        nagdevi_office_qty: quantities.nagdevi,
        quantity: quantities.total,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Update item details (price, box packing, category, etc.)
  updateItemDetails: async (id: string, updates: Partial<InventoryItem>) => {
    const rowUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) rowUpdates.name = String(updates.name).trim().toUpperCase();
    if (updates.price !== undefined) rowUpdates.price = Number(updates.price);
    if (updates.boxPacking !== undefined) rowUpdates.box_packing = updates.boxPacking ? String(updates.boxPacking).trim().toUpperCase() : null;
    if (updates.category !== undefined) rowUpdates.category = updates.category ? String(updates.category).trim().toUpperCase() : null;
    if (updates.orderIndex !== undefined) rowUpdates.order_index = Number(updates.orderIndex);

    const { error } = await supabase.from('inventory').update(rowUpdates).eq('id', id);
    if (error) throw error;
  },

  // Delete an item
  deleteItem: async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) throw error;
  },

  // Delete all items
  deleteAllItems: async () => {
    const { error } = await supabase.from('inventory').delete().neq('id', '___non_existent___');
    if (error) throw error;
  },

  // Batch insert/upsert items (chunks of 500)
  upsertItemsBatch: async (items: any[], onProgress?: (done: number, total: number) => void) => {
    const total = items.length;
    for (let i = 0; i < total; i += 500) {
      const chunk = items.slice(i, i + 500).map(supabaseService.mapItemToRow);
      const { error } = await supabase.from('inventory').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      if (onProgress) onProgress(Math.min(i + 500, total), total);
      await new Promise(r => setTimeout(r, 40));
    }
  },

  // Sales
  fetchSales: async (): Promise<SaleRecord[]> => {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      customerName: row.customer_name,
      companyName: row.company_name,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      totalAmount: Number(row.total_amount),
      location: row.location as SaleLocation,
      notes: row.notes || undefined,
      ownerId: row.owner_id,
      soldAt: row.sold_at ? { seconds: Math.floor(new Date(row.sold_at).getTime() / 1000) } : null,
    }));
  },

  recordSale: async (sale: any) => {
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const { error: saleErr } = await supabase.from('sales').insert({
      id: saleId,
      item_id: sale.itemId,
      item_name: sale.itemName,
      customer_name: sale.customerName,
      company_name: sale.companyName,
      quantity: sale.quantity,
      unit_price: sale.unitPrice,
      total_amount: sale.totalAmount,
      location: sale.location,
      notes: sale.notes || null,
      owner_id: sale.ownerId || 'system',
      sold_at: new Date().toISOString(),
    });
    if (saleErr) throw saleErr;
    return saleId;
  },

  deleteSale: async (saleId: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    if (error) throw error;
  },

  // Purchases
  fetchPurchases: async (): Promise<PurchaseRecord[]> => {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('purchased_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      supplierName: row.supplier_name,
      boxPacking: row.box_packing || undefined,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      totalAmount: Number(row.total_amount),
      location: row.location as SaleLocation,
      notes: row.notes || undefined,
      ownerId: row.owner_id,
      purchasedAt: row.purchased_at ? { seconds: Math.floor(new Date(row.purchased_at).getTime() / 1000) } : null,
    }));
  },

  recordPurchase: async (purchase: any) => {
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const { error: purErr } = await supabase.from('purchases').insert({
      id: purchaseId,
      item_id: purchase.itemId,
      item_name: purchase.itemName,
      supplier_name: purchase.supplierName,
      box_packing: purchase.boxPacking || null,
      quantity: purchase.quantity,
      unit_price: purchase.unitPrice,
      total_amount: purchase.totalAmount,
      location: purchase.location,
      notes: purchase.notes || null,
      owner_id: purchase.ownerId || 'system',
      purchased_at: new Date().toISOString(),
    });
    if (purErr) throw purErr;
    return purchaseId;
  },

  deletePurchase: async (purchaseId: string) => {
    const { error } = await supabase.from('purchases').delete().eq('id', purchaseId);
    if (error) throw error;
  },

  // Audit Logs
  fetchAuditLogs: async (limitCount: number = 500): Promise<AuditLog[]> => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limitCount);

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      itemId: row.item_id || undefined,
      itemName: row.item_name,
      action: row.action as AuditAction,
      changes: row.changes || undefined,
      performedBy: row.performed_by,
      performedByEmail: row.performed_by_email,
      timestamp: row.timestamp ? { seconds: Math.floor(new Date(row.timestamp).getTime() / 1000) } : null,
    }));
  },

  logAudit: async (log: any) => {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await supabase.from('audit_logs').insert({
      id: logId,
      item_id: log.itemId || null,
      item_name: log.itemName,
      action: log.action,
      changes: log.changes || null,
      performed_by: log.performedBy || '',
      performed_by_email: log.performedByEmail || '',
      timestamp: new Date().toISOString(),
    });
  },
};
