import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { inventoryService } from '../services/inventoryService';
import { serverTimestamp, getDocs, collection, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StatusModal, StatusType } from './StatusModal';
import { ReconciliationModal } from './ReconciliationModal';
import { ReconciliationReport } from '../types';

export const parseDateValue = (rawVal: any): Timestamp | undefined => {
  if (rawVal === undefined || rawVal === null || rawVal === '') return undefined;

  // 1. If already a Firestore Timestamp
  if (rawVal instanceof Timestamp) return rawVal;
  if (typeof rawVal === 'object' && typeof rawVal.seconds === 'number') {
    return new Timestamp(rawVal.seconds, rawVal.nanoseconds || 0);
  }

  // 2. If it's a native JS Date object
  if (rawVal instanceof Date) {
    if (!isNaN(rawVal.getTime())) return Timestamp.fromDate(rawVal);
    return undefined;
  }

  // 3. If it's a numeric timestamp or Excel serial date
  if (typeof rawVal === 'number') {
    if (rawVal > 1000000000000) {
      return Timestamp.fromMillis(rawVal);
    }
    if (rawVal > 1000000000) {
      return Timestamp.fromMillis(rawVal * 1000);
    }
    // Excel serial date code (e.g. 46304 is Oct 9, 2026)
    if (rawVal > 30000 && rawVal < 65000) {
      const jsDate = new Date(Math.round((rawVal - 25569) * 86400 * 1000));
      if (!isNaN(jsDate.getTime())) return Timestamp.fromDate(jsDate);
    }
    return undefined;
  }

  // 4. If string
  if (typeof rawVal === 'string') {
    const str = rawVal.trim();
    if (!str) return undefined;

    // Check if numeric string
    if (/^\d+(\.\d+)?$/.test(str)) {
      return parseDateValue(Number(str));
    }

    // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
    }

    // 2. Named months: "09-Oct-2026", "09 Oct 2026", "9 October 2026", "27 July 2026"
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const textMatch = str.match(/^(\d{1,2})[\s\-\/\.]([A-Za-z]+)(?:[\s\-\/\.](\d{2,4}))?/);
    if (textMatch) {
      const day = parseInt(textMatch[1], 10);
      const monKey = textMatch[2].toLowerCase().slice(0, 3);
      if (monKey in monthNames) {
        const month = monthNames[monKey];
        let year = textMatch[3] ? parseInt(textMatch[3], 10) : new Date().getFullYear();
        if (year < 100) year += 2000;
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
      }
    }

    // 3. Indian / British standard format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    // STRICT PRIORITY: First number is Day, second number is Month (e.g. 09/10/2026 = 9th October, NOT 10th September)
    const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
    }

    // 4. Standard Date.parse fallback
    const parsedMs = Date.parse(str);
    if (!isNaN(parsedMs)) {
      return Timestamp.fromMillis(parsedMs);
    }
  }

  return undefined;
};

export const ExcelImport: React.FC = () => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importProgress, setImportProgress] = React.useState<{ current: number; total: number; stage?: string } | null>(null);
  const [shouldClear, setShouldClear] = React.useState(false);
  const [reconciliationReport, setReconciliationReport] = React.useState<ReconciliationReport | null>(null);
  const [statusModal, setStatusModal] = React.useState<{
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

  const processFile = async (file: File) => {
    setStatus('processing');
    setImportProgress({ current: 0, total: 100, stage: 'Preparing import...' });
    
    try {
      // 1. Snapshot the current live state before any deletion/import for Reconciliation
      let baselineBeforeItems: Array<{ name: string; quantity?: number; price?: number }> = [];
      try {
        const liveSnap = await getDocs(collection(db, 'inventory'));
        baselineBeforeItems = liveSnap.docs.map(d => ({
          name: d.data().name,
          quantity: d.data().quantity,
          price: d.data().price,
        }));
      } catch (snapErr) {
        console.warn('Could not snapshot baseline items:', snapErr);
      }

      // 2. Safety First: Always clone current data to backup collection before any destructive import
      try {
        await inventoryService.backupAllDataToFirestoreCollection();
        console.log('Automated safety backup completed before import.');
      } catch (backupErr) {
        console.warn('Pre-import safety backup failed:', backupErr);
      }

      if (shouldClear) {
        setImportProgress({ current: 0, total: 100, stage: 'Deleting existing items in batches...' });
        await inventoryService.deleteAllItems((deleted, total) => {
          setImportProgress({ current: deleted, total, stage: `Deleted ${deleted}/${total} existing items...` });
        });
      }

      const reader = new FileReader();
      
      if (file.name.endsWith('.json')) {
        reader.onload = async (e) => {
          try {
            const content = e.target?.result as string;
            const parsed = JSON.parse(content);
            const rawItems = Array.isArray(parsed) ? parsed : (parsed.inventory || []);

            if (rawItems.length > 0) {
              const formattedItems = rawItems.map((item: any) => ({
                name: String(item.name || '').trim().toUpperCase(),
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 0,
                upperOfficeQty: Number(item.upperOfficeQty) || 0,
                downOfficeQty: Number(item.downOfficeQty) || 0,
                nagdeviOfficeQty: Number(item.nagdeviOfficeQty) || 0,
                boxPacking: item.boxPacking ? String(item.boxPacking).trim().toUpperCase() : undefined,
                category: item.category ? String(item.category).trim().toUpperCase() : undefined,
                updatedAt: item.updatedAt?.seconds 
                  ? new Timestamp(item.updatedAt.seconds, item.updatedAt.nanoseconds || 0)
                  : item.updatedAt,
                createdAt: item.createdAt?.seconds 
                  ? new Timestamp(item.createdAt.seconds, item.createdAt.nanoseconds || 0)
                  : item.createdAt,
              })).filter((i: any) => i.name.length > 0);

              await inventoryService.importItems(formattedItems as any);
              setStatus('success');
              setStatusModal({
                isOpen: true,
                type: 'success',
                title: 'Backup Restored',
                message: `Successfully restored ${formattedItems.length} items from JSON backup.`
              });
              setTimeout(() => setStatus('idle'), 3000);
            } else {
              setStatus('idle');
              setStatusModal({
                isOpen: true,
                type: 'error',
                title: 'No Items Found',
                message: 'No valid items found inside this JSON backup file.'
              });
            }
          } catch (err: any) {
            console.error('JSON restore error:', err);
            setStatus('error');
            setStatusModal({
              isOpen: true,
              type: 'error',
              title: 'Restore Failed',
              message: err?.message || 'Could not parse JSON backup file.'
            });
          }
        };
        reader.readAsText(file);
      } else if (file.name.endsWith('.docx')) {
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            // Generate clean HTML structure to preserve tables and paragraphs properly
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value || '';
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const tables = doc.querySelectorAll('table');
            
            const formattedItems: any[] = [];

            if (tables.length > 0) {
              // Word Doc has tables! Parse them row by row, keeping layout structure intact
              tables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                  const cells = Array.from(row.querySelectorAll('td, th'))
                    .map(cell => cell.textContent?.trim() || '');
                  
                  // Filter out empty rows
                  if (cells.length === 0 || cells.every(c => !c)) {
                    return;
                  }

                  // 1. Detect column header row
                  // If cells contain: "NO", "Items", "SR. NO", "S.NO", "Item Name", etc.
                  const isHeaderRow = cells.some(cellText => {
                    const cleanText = cellText.toLowerCase().replace(/[\.\s]+/g, '');
                    return cleanText === 'items' || 
                           cleanText === 'no' || 
                           cleanText === 'srno' || 
                           cleanText === 'sno' || 
                           cleanText === 'itemname' || 
                           cleanText === 'heading' ||
                           cleanText === 'partno' ||
                           cleanText === 'name';
                  });

                  if (isHeaderRow) {
                    return; // Skip table header columns row
                  }

                  // 2. Map cells to Item attributes
                  let name = '';
                  let price = 0;
                  let upper = 0;
                  let down = 0;
                  let nagdevi = 0;

                  if (cells.length === 1) {
                    // Single cell spanning row - can be section header
                    const text = cells[0];
                    const lowerText = text.toLowerCase();
                    // Skip typical category separators
                    const isSeparator = lowerText.includes('category') || 
                                       lowerText.includes('section') || 
                                       lowerText.endsWith('items') || 
                                       lowerText.endsWith('products') || 
                                       lowerText.endsWith('fittings') || 
                                       lowerText.includes('---') || 
                                       lowerText.includes('===');
                    if (isSeparator) return;
                    name = text;
                  } else if (cells.length === 2) {
                    // 2 columns (e.g. Serial / NO | Item Name)
                    // If first cell is a number/empty, then col 1 is the item name
                    const col0 = cells[0];
                    const col1 = cells[1];
                    
                    if (!col1 && col0) {
                      name = col0;
                    } else if (col1) {
                      name = col1;
                    }
                  } else {
                    // Multi-column table (Name, Price, Upper, Down, Nagdevi, Net)
                    // Check if second column or first column is Name
                    name = cells[1] || cells[0];
                    price = Number(cells[2]) || 0;
                    upper = Number(cells[3]) || 0;
                    down = Number(cells[4]) || 0;
                    nagdevi = Number(cells[5]) || 0;
                  }

                  const cleanName = name.replace(/\s+/g, ' ').trim();
                  if (!cleanName) return;

                  // Skip any final item name checks (e.g. if name is numerical serial, or matches header words)
                  const nameLower = cleanName.toLowerCase().replace(/[\.\s]+/g, '');
                  if (
                    nameLower === 'items' || 
                    nameLower === 'no' || 
                    nameLower === 'srno' || 
                    nameLower === 'sno' || 
                    nameLower === 'itemname' || 
                    nameLower === 'total' || 
                    nameLower === 'grandtotal'
                  ) {
                    return; 
                  }

                  // Skip if purely numeric
                  if (/^\d+$/.test(cleanName)) {
                    return;
                  }

                  formattedItems.push({
                    name: cleanName.toUpperCase(),
                    price,
                    quantity: upper + down + nagdevi,
                    upperOfficeQty: upper,
                    downOfficeQty: down,
                    nagdeviOfficeQty: nagdevi,
                    createdAt: serverTimestamp(),
                  });
                });
              });
            } else {
              // Word Doc has NO tables! Fallback to paragraphs
              const paragraphs = Array.from(doc.querySelectorAll('p, li, h1, h2, h3, h4'))
                .map(el => el.textContent?.trim() || '')
                .filter(text => text.length > 0);

              paragraphs.forEach(line => {
                // Same smart filters on text
                const lowerLine = line.toLowerCase().replace(/[\.\s]+/g, '');
                if (
                  lowerLine === 'items' || 
                  lowerLine === 'no' || 
                  lowerLine === 'srno' || 
                  lowerLine === 'sno' || 
                  lowerLine === 'itemname' || 
                  lowerLine === 'total' || 
                  lowerLine === 'grandtotal' ||
                  lowerLine.includes('category') || 
                  lowerLine.includes('section') || 
                  lowerLine.endsWith('items') || 
                  lowerLine.endsWith('products') || 
                  lowerLine.endsWith('fittings') || 
                  lowerLine.includes('---') || 
                  lowerLine.includes('===')
                ) {
                  return; // Skip headers / categories
                }

                if (/^\d+$/.test(line)) {
                  return; // Skip pure numeric serials
                }

                // Check for comma separations
                const parts = line.split(/[,\t]+/).map(p => p.trim());
                if (parts.length > 1) {
                  const name = parts[0];
                  const price = Number(parts[1]) || 0;
                  const upper = Number(parts[2]) || 0;
                  const down = Number(parts[3]) || 0;
                  const nagdevi = Number(parts[4]) || 0;
                  const total = parts[5] ? Number(parts[5]) : (upper + down + nagdevi);

                  formattedItems.push({
                    name: name.toUpperCase(),
                    price,
                    quantity: total,
                    upperOfficeQty: upper,
                    downOfficeQty: down,
                    nagdeviOfficeQty: nagdevi,
                    createdAt: serverTimestamp(),
                  });
                } else {
                  formattedItems.push({
                    name: line.toUpperCase(),
                    price: 0,
                    quantity: 0,
                    upperOfficeQty: 0,
                    downOfficeQty: 0,
                    nagdeviOfficeQty: 0,
                    createdAt: serverTimestamp(),
                  });
                }
              });
            }

            if (formattedItems.length > 0) {
              await inventoryService.importItems(formattedItems as any);
              setStatus('success');
              setStatusModal({
                isOpen: true,
                type: 'success',
                title: 'Import Successful',
                message: `${formattedItems.length} items have been imported from Word document.`
              });
              setTimeout(() => setStatus('idle'), 3000);
            } else {
              setStatus('idle');
              setStatusModal({
                isOpen: true,
                type: 'error',
                title: 'No Items Found',
                message: 'No valid item names were detected in the Word document.'
              });
            }
          } catch (err) {
            console.error('Word Docx import failure:', err);
            throw err;
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.txt')) {
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            const formattedItems = lines.map(name => ({
              name: name.toUpperCase(), // Match the business style
              price: 0,
              quantity: 0,
              upperOfficeQty: 0,
              downOfficeQty: 0,
              nagdeviOfficeQty: 0,
              createdAt: serverTimestamp(),
            }));

            if (formattedItems.length > 0) {
              await inventoryService.importItems(formattedItems as any);
              setStatus('success');
              setStatusModal({
                isOpen: true,
                type: 'success',
                title: 'Import Successful',
                message: `${formattedItems.length} items have been imported from text file.`
              });
              setTimeout(() => setStatus('idle'), 3000);
            } else {
              setStatus('idle');
            }
          } catch (err) {
            throw err;
          }
        };
        reader.readAsText(file);
      } else {
        // Excel/CSV logic
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            // Use cellDates: false and raw: true so SheetJS preserves raw strings (09/10/2026) instead of parsing as US MM/DD/YYYY
            const workbook = XLSX.read(data, { type: 'array', cellDates: false, raw: true });
            const firstSheetName = workbook.SheetNames[0];
            const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[firstSheetName], { raw: true });

            console.log('Uploaded File Parsed:', {
              sheetName: firstSheetName,
              rowCount: rawRows?.length,
              sampleRow: rawRows?.[0],
              sampleHeaders: rawRows?.[0] ? Object.keys(rawRows[0]) : []
            });

            if (!rawRows || rawRows.length === 0) {
              setImportProgress(null);
              setStatus('idle');
              setStatusModal({
                isOpen: true,
                type: 'error',
                title: 'No Items Found',
                message: 'This Excel sheet has no rows or is empty.'
              });
              return;
            }

            const formattedItems = rawRows.map((row, index) => {
              // Create normalized key-value lookup (lowercase, stripped spaces)
              const cleanRow: Record<string, any> = {};
              Object.keys(row).forEach(k => {
                const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                cleanRow[normalizedKey] = row[k];
              });

              const name = String(
                cleanRow['itemname'] || 
                cleanRow['name'] || 
                cleanRow['item'] || 
                cleanRow['particulars'] || 
                cleanRow['description'] || 
                ''
              ).trim();

              const price = Number(cleanRow['price'] || cleanRow['rate'] || cleanRow['unitprice'] || 0) || 0;
              const upper = Number(cleanRow['upperoffice'] || cleanRow['upperofficeqty'] || cleanRow['upper'] || 0) || 0;
              const down = Number(cleanRow['downoffice'] || cleanRow['downofficeqty'] || cleanRow['down'] || 0) || 0;
              const nagdevi = Number(cleanRow['nagdevioffice'] || cleanRow['nagdeviofficeqty'] || cleanRow['nagdevi'] || 0) || 0;
              const total = Number(cleanRow['totalqty'] || cleanRow['total'] || cleanRow['quantity'] || cleanRow['qty'] || (upper + down + nagdevi)) || 0;
              const boxPacking = String(cleanRow['boxpacking'] || cleanRow['packing'] || cleanRow['pack'] || '').trim();
              const category = String(
                cleanRow['categorymodel'] || 
                cleanRow['category'] || 
                cleanRow['cat'] || 
                cleanRow['group'] || 
                cleanRow['model'] || 
                cleanRow['machine'] || 
                ''
              ).trim();

              // Parse Last Updated date from any matching column
              const rawDateVal = 
                cleanRow['lastupdated'] || 
                cleanRow['lastupdateddate'] || 
                cleanRow['lastupdate'] || 
                cleanRow['updatedat'] || 
                cleanRow['updateddate'] || 
                cleanRow['updated'] || 
                cleanRow['lastmodified'] || 
                cleanRow['modifieddate'] || 
                cleanRow['stockdate'] || 
                cleanRow['date'];

              const parsedUpdatedAt = parseDateValue(rawDateVal);

              // Maintain exact sequence/row position from spreadsheet
              const rowOrder = Number(cleanRow['srno'] || cleanRow['sno'] || cleanRow['no'] || cleanRow['seq'] || cleanRow['orderindex']);
              const orderIndex = !isNaN(rowOrder) && rowOrder > 0 ? rowOrder * 100 : (index + 1) * 100;

              return {
                name: name.toUpperCase(),
                price,
                quantity: total,
                upperOfficeQty: upper,
                downOfficeQty: down,
                nagdeviOfficeQty: nagdevi,
                boxPacking: boxPacking ? boxPacking.toUpperCase() : undefined,
                category: category ? category.toUpperCase() : undefined,
                updatedAt: parsedUpdatedAt,
                orderIndex,
              };
            }).filter(item => item.name && item.name.length > 0 && item.name !== 'UNNAMED ITEM');

            if (formattedItems.length > 0) {
              setImportProgress({ current: 0, total: formattedItems.length, stage: 'Importing items in batches of 500...' });
              await inventoryService.importItems(formattedItems as any, (current, total) => {
                setImportProgress({ current, total, stage: `Imported ${current} / ${total} items...` });
              });
              setImportProgress(null);
              setStatus('success');

              if (baselineBeforeItems.length > 0) {
                const report = inventoryService.reconcileInventory(baselineBeforeItems, formattedItems);
                setReconciliationReport(report);
              } else {
                setStatusModal({
                  isOpen: true,
                  type: 'success',
                  title: 'Import Successful',
                  message: `${formattedItems.length} items have been imported.`
                });
              }

              setTimeout(() => setStatus('idle'), 3000);
            } else {
              setImportProgress(null);
              setStatus('idle');
              setStatusModal({
                isOpen: true,
                type: 'error',
                title: 'No Items Found',
                message: 'Could not find an "Item Name" or "Name" column in this Excel sheet. Please check the column header.'
              });
            }
          } catch (err: any) {
            console.error('Excel row processing / import error:', err);
            setStatus('error');
            setStatusModal({
              isOpen: true,
              type: 'error',
              title: 'Import Error',
              message: err?.message || 'Could not parse or write items from this spreadsheet.'
            });
          }
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('Import failed:', error);
      setStatus('error');
      setStatusModal({
        isOpen: true,
        type: 'error',
        title: 'Import Failed',
        message: 'There was an error during the batch process.'
      });
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (
      file.name.endsWith('.xlsx') || 
      file.name.endsWith('.xls') || 
      file.name.endsWith('.csv') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.docx')
    )) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-solid">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-blue-600" />
          Batch Import
        </h2>
        {status === 'success' && (
          <div className="flex items-center gap-1 text-emerald-600 text-xs font-black uppercase">
            <CheckCircle2 size={14} />
            Done
          </div>
        )}
      </div>

      <div className="p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center gap-3 ${
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/20'
          }`}
        >
          {status === 'processing' ? (
            <div className="animate-spin text-blue-500">
               <Upload size={24} />
            </div>
          ) : (
            <Upload className={`text-slate-400 transition-transform ${isDragging ? '-translate-y-1' : ''}`} size={24} />
          )}
          <div className="text-center">
            <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
              {status === 'processing' ? 'Processing...' : 'Drag & Drop Excel, TXT or DOCX'}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">or click to browse</p>
          </div>
          <input
            type="file"
            accept=".xlsx, .xls, .csv, .txt, .docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            disabled={status === 'processing'}
          />
        </div>

        {status === 'processing' && importProgress && (
          <div className="mt-4 p-4 bg-blue-50/90 border border-blue-200 rounded-xl space-y-2 animate-fadeIn">
            <div className="flex justify-between items-center text-xs font-black text-blue-800 uppercase tracking-wider">
              <span>{importProgress.stage || 'Processing in batches...'}</span>
              <span>{importProgress.current} / {importProgress.total}</span>
            </div>
            <div className="w-full bg-blue-200/80 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 transition-all duration-200 rounded-full"
                style={{ width: `${importProgress.total > 0 ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider text-right">
              {importProgress.total > 0 ? `${Math.round((importProgress.current / importProgress.total) * 100)}% Complete` : ''}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100">
          <input
            type="checkbox"
            id="clearDB"
            checked={shouldClear}
            onChange={(e) => setShouldClear(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <label htmlFor="clearDB" className="text-[10px] font-black text-red-600 uppercase tracking-widest cursor-pointer select-none">
            Delete existing items before import
          </label>
        </div>

        <div className="mt-4 p-3 bg-blue-50/50 rounded-lg">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Spreadsheet, Text or Word Format</p>
          <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">
            TXT/DOCX: <span className="text-slate-700">One item per line or Comma Separated (Name, Price, Upper, Down, Nagdevi)</span><br/>
            XLS/CSV: <span className="text-slate-700">Name, Price, Office Quantities</span>
          </p>
        </div>
      </div>

      <StatusModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
      />

      <ReconciliationModal
        isOpen={Boolean(reconciliationReport)}
        onClose={() => setReconciliationReport(null)}
        report={reconciliationReport}
      />
    </div>
  );
};
