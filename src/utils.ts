import { LogisticsDocumentType, PendingDocument } from './types';
import * as XLSX from 'xlsx';

/**
 * Phase 1: Raw Parsing
 * Just reads the Excel file and extracts raw data rows without heavy processing.
 */
export const parseExcelRaw = (file: File): Promise<{ rows: any[][], headerIndex: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        
        // Detect legacy XLS (OLE2 compound file) signature if needed for logging
        // const isLegacyXLS = data.length >= 8 &&
        //   data[0] === 0xD0 && data[1] === 0xCF && data[2] === 0x11 && data[3] === 0xE0 &&
        //   data[4] === 0xA1 && data[5] === 0xB1 && data[6] === 0x1A && data[7] === 0xE1;

        let workbook;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;

        // Suppress XLS parsing noise from sheetjs for legacy records
        const isXlsNoise = (args: any[]) => {
          const msg = args.map(arg => typeof arg === 'string' ? arg : String(arg)).join(' ');
          return msg.includes('Missing Info') || msg.includes('XLS Record') || 
                 msg.includes('0x299') || msg.includes('0x3433') || msg.includes('0x2801') || msg.includes('0x027d');
        };

        console.error = (...args: any[]) => {
          if (isXlsNoise(args)) return;
          originalConsoleError.apply(console, args);
        };
        console.warn = (...args: any[]) => {
          if (isXlsNoise(args)) return;
          originalConsoleWarn.apply(console, args);
        };

        try {
          workbook = XLSX.read(data, { 
            type: 'array', 
            cellDates: true, 
            cellStyles: false,
            cellNF: false,
            cellText: false,
            cellFormula: false,
            bookVBA: false,
            bookDeps: false,
            WTF: false 
          });
        } catch (e) {
          workbook = XLSX.read(data, { type: 'array', WTF: false });
        } finally {
          // Restore original consoles
          console.error = originalConsoleError;
          console.warn = originalConsoleWarn;
        }

        if (!workbook || !workbook.SheetNames.length) {
          throw new Error("El archivo no contiene hojas válidas.");
        }

        let jsonDataRaw: any[][] = [];
        let headerIndex = -1;
        let sheetRead = "";

        // Try to find the first sheet that actually has data
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          // Try standard read
          let data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
          
          // If empty, it might be due to a bad !ref in the Excel file. Try reading from A1.
          if (data.length === 0 && worksheet['!ref']) {
            console.log(`Reintentando lectura de "${sheetName}" forzando rango A1...`);
            data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", range: 0 }) as any[][];
          }

          if (data.length > 0) {
            jsonDataRaw = data;
            sheetRead = sheetName;
            break;
          }
        }

        if (jsonDataRaw.length === 0) {
          console.warn("Todas las hojas del archivo parecen estar vacías.");
          resolve({ rows: [], headerIndex: -1 });
          return;
        }

        console.log(`Leída hoja: "${sheetRead}" con ${jsonDataRaw.length} filas.`);

        const normalize = (s: any) => {
          if (s === undefined || s === null) return "";
          return String(s).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
        };

        const targetHeaderKeywords = [
          'numdoc', 'folio', 'documento', 'vendedor', 'total', 'cant', 'sku', 
          'cliente', 'totpend', 'numnota', 'razsoc', 'obsguia', 'nom_vended', 
          'nomvended', 'fecdoc', 'fecemision', 'razonsocial', 'precio', 'item', 
          'descripcion', 'tipontav', 'cod_articu', 'numordc', 'pend', 'descr', 'obra'
        ];
        
        for (let i = 0; i < Math.min(jsonDataRaw.length, 150); i++) {
          const row = jsonDataRaw[i];
          if (!row || !Array.isArray(row)) continue;
          
          // Count how many keywords match this row
          const matches = row.filter(cell => {
             const n = normalize(cell);
             if (!n) return false;
             return targetHeaderKeywords.some(kw => n.includes(kw));
          });

          // Increased detection threshold: if we find 2 or more keywords, it's likely the header
          if (matches.length >= 2) {
            headerIndex = i;
            break;
          }
          
          // Special case: if the first column is exactly 'numnota', it's almost certainly the header
          if (normalize(row[0]) === 'numnota') {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          console.warn("No se detectó una fila de encabezados clara. Se asumirá la primera fila.");
        }

        resolve({ rows: jsonDataRaw, headerIndex });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Phase 2: Analysis Logic
 */
export const analyzeRawRows = (
  rows: any[][], 
  headerIndex: number, 
  type: LogisticsDocumentType,
  onProgress?: (curr: number, total: number) => void
): Promise<PendingDocument[]> => {
  return new Promise((resolve, reject) => {
    try {
      const headerRow = rows[headerIndex >= 0 ? headerIndex : 0] || [];
      const jsonDataAll = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
      
      const normalize = (s: any) => {
        if (s === undefined || s === null) return "";
        return String(s).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
      };

      const availableKeys = headerRow.map(String);
      const normalizedKeysMap = availableKeys.map(k => ({ original: k, norm: normalize(k) }));

      const findKey = (targets: string[]): string | null => {
        const normalizedTargets = targets.map(normalize);
        for (const t of normalizedTargets) {
          const match = normalizedKeysMap.find(ak => ak.norm === t);
          if (match) return match.original;
        }
        for (const t of normalizedTargets) {
          if (t.length < 3) continue;
          const match = normalizedKeysMap.find(ak => ak.norm.includes(t));
          if (match) return match.original;
        }
        return null;
      };

      const fieldMapping = {
        folio: findKey(['folio', 'documento', 'numdoc']),
        numNota: findKey(['numnota', 'nro_nota', 'nota']),
        razonSocial: findKey(['razsoc', 'razon social', 'cliente', 'nombre']),
        vendedor: findKey(['nom_vended', 'nomvended', 'vendedor']),
        fecha: findKey(['fecha', 'fecdoc', 'fecemision', 'emision', 'factual']),
        totalPendiente: findKey(['totpend', 'pendiente', 'saldo', 'total']),
        observaciones: findKey(['obsguia', 'observaciones', 'obs']),
        codigo: findKey(['codigo', 'sku', 'partno', 'item', 'codarticu', 'articu', 'codprod']),
        descripcion: findKey(['descripcion', 'glosa', 'detalle', 'prod', 'descr', 'nombre', 'producto', 'articulo', 'nombrearticu', 'nombreproducto']),
        cantidad: findKey(['cantidad', 'cant', 'qty', 'unidades', 'unid', 'cant_pend']),
        cantReci: findKey(['cantreci', 'recibida']),
        precio: findKey(['precio', 'valor', 'unitario']),
        totalLinea: findKey(['totallinea', 'subtotal', 'lineatotal'])
      };

      const documentsMap = new Map<string, PendingDocument>();
      const BATCH_SIZE = 300;
      let idx = 0;

      const processBatch = () => {
        const end = Math.min(idx + BATCH_SIZE, jsonDataAll.length);
        
        for (; idx < end; idx++) {
          const rawRow = jsonDataAll[idx];
          const row: any = {};
          headerRow.forEach((h, i) => { if (h !== "") row[String(h)] = rawRow[i]; });

          const folioVal = fieldMapping.folio ? String(row[fieldMapping.folio] || '').trim() : '';
          const numNotaVal = fieldMapping.numNota ? String(row[fieldMapping.numNota] || '').trim() : '';
          const docId = numNotaVal || folioVal;
          
          if (!docId || docId.toLowerCase() === "undefined") continue;

          const fullId = `${type}-${docId}`;
          let doc = documentsMap.get(fullId);

          if (!doc) {
            let rawFecha = fieldMapping.fecha ? row[fieldMapping.fecha] : undefined;
            let fecha: Date;
            if (rawFecha instanceof Date) {
              fecha = rawFecha;
            } else if (typeof rawFecha === 'number') {
              try { const d = XLSX.SSF.parse_date_code(rawFecha); fecha = new Date(d.y, d.m-1, d.d); } catch { fecha = new Date(); }
            } else {
              fecha = new Date(rawFecha);
            }
            if (isNaN(fecha.getTime())) fecha = new Date();

            let rawTotalVal = fieldMapping.totalPendiente ? row[fieldMapping.totalPendiente] : 0;
            let finalValue = 0;
            if (typeof rawTotalVal === 'number') finalValue = rawTotalVal;
            else {
              let s = String(rawTotalVal || '0').replace(/[^0-9,.]/g, "");
              if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
              else if (s.includes(",")) s = s.replace(",", ".");
              finalValue = parseFloat(s) || 0;
            }

            doc = {
              documentNumber: docId,
              id: fullId,
              fecha: fecha,
              tipo: type,
              razonSocial: fieldMapping.razonSocial ? String(row[fieldMapping.razonSocial] || 'N/A').toUpperCase() : 'N/A',
              vendedor: fieldMapping.vendedor ? String(row[fieldMapping.vendedor] || 'N/A') : 'N/A',
              totalPendiente: type === 'OC' ? 0 : Math.abs(finalValue),
              observaciones: fieldMapping.observaciones ? String(row[fieldMapping.observaciones] || '') : '',
              detalle: []
            };
            documentsMap.set(fullId, doc);
          } else if (type !== 'OC' && fieldMapping.totalPendiente) {
            let val = 0;
            let rawT = row[fieldMapping.totalPendiente];
            if (typeof rawT === 'number') val = rawT;
            else {
              let s = String(rawT || '0').replace(/[^0-9,.]/g, "");
              if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", "."); else if (s.includes(",")) s = s.replace(",", ".");
              val = parseFloat(s) || 0;
            }
            doc.totalPendiente += Math.abs(val);
          }

          let finalCantidad = 0;
          if (fieldMapping.cantidad) {
            finalCantidad = parseFloat(String(row[fieldMapping.cantidad] || '0')) || 0;
            if (type === 'OC' && fieldMapping.cantReci) finalCantidad -= parseFloat(String(row[fieldMapping.cantReci] || '0')) || 0;
          }

          doc.detalle.push({
            codigo: fieldMapping.codigo ? String(row[fieldMapping.codigo] || '') : '',
            descripcion: fieldMapping.descripcion ? String(row[fieldMapping.descripcion] || '') : '',
            cantidad: finalCantidad,
            precio: fieldMapping.precio ? (parseFloat(String(row[fieldMapping.precio] || '0')) || 0) : 0,
            total: fieldMapping.totalLinea ? (parseFloat(String(row[fieldMapping.totalLinea] || '0')) || 0) : 0
          });
        }

        if (onProgress) onProgress(idx, jsonDataAll.length);
        if (idx < jsonDataAll.length) setTimeout(processBatch, 20);
        else resolve(Array.from(documentsMap.values()));
      };

      processBatch();
    } catch (err) {
      reject(err);
    }
  });
};

export const parseExcelFile = async (file: File, type: LogisticsDocumentType): Promise<PendingDocument[]> => {
  const { rows, headerIndex } = await parseExcelRaw(file);
  return analyzeRawRows(rows, headerIndex, type);
};
