import * as XLSX from 'xlsx';

const REQUIRED_COLUMNS = ['PATENTE', 'TIPO DE VEHICULO', 'Accion', 'Fecha y hora', 'CANT PAQUETES'];
const PREFERRED_SHEET = 'reporte_registros';
const HEADER_ROW = 4; // 1-indexed

/**
 * Parsea el archivo Easy_Docking.xlsx.
 * Headers en fila 4 de la hoja reporte_registros.
 * Retorna { data, error }
 */
export function parseDockingXLSX(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });

        const sheetName = wb.SheetNames.includes(PREFERRED_SHEET)
          ? PREFERRED_SHEET
          : wb.SheetNames[0];

        if (!sheetName) {
          return resolve({ data: null, error: 'El archivo Excel no contiene hojas.' });
        }

        const ws = wb.Sheets[sheetName];
        // range override: empezar desde fila 4 (0-indexed = 3)
        const range = XLSX.utils.decode_range(ws['!ref']);
        range.s.r = HEADER_ROW - 1; // fila 4 como headers
        ws['!ref'] = XLSX.utils.encode_range(range);

        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows || rows.length === 0) {
          return resolve({ data: null, error: 'El archivo Docking no contiene datos para procesar.' });
        }

        const headers = Object.keys(rows[0]);
        const missing = REQUIRED_COLUMNS.filter(
          (col) => !headers.some((h) => h.trim() === col)
        );

        if (missing.length > 0) {
          return resolve({
            data: null,
            error: `Columnas faltantes en Docking: ${missing.join(', ')}`,
          });
        }

        // Normalizar headers y convertir fechas seriales de Excel
        const normalized = rows.map((row) => {
          const clean = {};
          for (const key of Object.keys(row)) {
            const k = key.trim();
            let val = row[key];
            // Convertir número serial de Excel a fecha legible
            if (typeof val === 'number' && val > 40000 && val < 60000) {
              const date = XLSX.SSF.parse_date_code(val);
              const pad = (n) => String(n).padStart(2, '0');
              val = `${date.y}-${pad(date.m)}-${pad(date.d)} ${pad(date.H)}:${pad(date.M)}:${pad(date.S)}`;
            }
            clean[k] = val;
          }
          return clean;
        });

        console.log('=== DOCKING headers reales ===', Object.keys(normalized[0]));
        console.log('=== DOCKING fila 0 ===', normalized[0]);

        resolve({ data: normalized, error: null });
      } catch (err) {
        resolve({ data: null, error: `Error al leer el Excel: ${err.message}` });
      }
    };
    reader.onerror = () => resolve({ data: null, error: 'No se pudo leer el archivo.' });
    reader.readAsArrayBuffer(file);
  });
}
