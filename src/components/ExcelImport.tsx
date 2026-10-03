import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { inventoryService } from '../services/inventoryService';
import { serverTimestamp } from 'firebase/firestore';
import { StatusModal, StatusType } from './StatusModal';

export const ExcelImport: React.FC = () => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [shouldClear, setShouldClear] = React.useState(false);
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
    
    try {
      if (shouldClear) {
        await inventoryService.deleteAllItems();
      }

      const reader = new FileReader();
      
      if (file.name.endsWith('.docx')) {
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
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const items = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

            const formattedItems = items.map((row: any) => {
              const upper = Number(row['Upper Office'] || row.upperOfficeQty || 0);
              const down = Number(row['Down Office'] || row.downOfficeQty || 0);
              const nagdevi = Number(row['Nagdevi Office'] || row.nagdeviOfficeQty || 0);
              const price = Number(row.Price || row.price || 0);
              const name = String(row.Name || row.name || 'Unnamed Item');
              const total = row.Quantity || row.quantity || (upper + down + nagdevi);
              const boxPacking = String(row['Box Packing'] || row['boxPacking'] || row['Packing'] || row['packing'] || '').trim();

              return {
                name: name.toUpperCase(),
                price,
                quantity: Number(total),
                upperOfficeQty: upper,
                downOfficeQty: down,
                nagdeviOfficeQty: nagdevi,
                createdAt: serverTimestamp(),
                boxPacking: boxPacking ? boxPacking.toUpperCase() : undefined,
              };
            });

            if (formattedItems.length > 0) {
              await inventoryService.importItems(formattedItems as any);
              setStatus('success');
              setStatusModal({
                isOpen: true,
                type: 'success',
                title: 'Import Successful',
                message: `${formattedItems.length} items have been imported.`
              });
              setTimeout(() => setStatus('idle'), 3000);
            } else {
              setStatus('idle');
            }
          } catch (err) {
            throw err;
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
    </div>
  );
};
