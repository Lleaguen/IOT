import Papa from 'papaparse';

const REQUIRED_COLUMNS = [
  'Truck ID',
  'Inbound Carrier Name',
  'Inbound ID',
  'Shipment ID',
  'Inbound Date Opened',
  'Inbound Date Closed',
];

/**
 * Parsea el TMS CSV. Detecta delimitador automáticamente.
 * Retorna { data, error }
 */
export function parseTmsCSV(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t'],
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          return resolve({ data: null, error: 'El archivo TMS no contiene datos para procesar.' });
        }

        const headers = Object.keys(results.data[0]);
        const missing = REQUIRED_COLUMNS.filter(
          (col) => !headers.some((h) => h.trim() === col)
        );

        if (missing.length > 0) {
          return resolve({
            data: null,
            error: `Columnas faltantes en TMS: ${missing.join(', ')}`,
          });
        }

        // Normalizar headers con trim
        const normalized = results.data.map((row) => {
          const clean = {};
          for (const key of Object.keys(row)) {
            clean[key.trim()] = row[key];
          }
          return clean;
        });

        resolve({ data: normalized, error: null });
      },
      error: (err) => resolve({ data: null, error: err.message }),
    });
  });
}
