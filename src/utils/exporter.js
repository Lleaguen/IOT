import * as XLSX from 'xlsx';

const YELLOW = 'FFFFFF00';
const RED = 'FFFF0000';

/**
 * Exporta los resultados a un archivo Excel con colores en la columna Patente.
 */
export function exportToExcel(results) {
  const today = new Date().toISOString().slice(0, 10);
  const filename = `IOT${today}.xlsx`;

  const headers = [
    'Carrier', 'Patente', 'Unidad', 'Arribo', 'Call',
    'Inicio IB TMS', 'Fin IB TMS', 'Total Shipments',
  ];

  const wb = XLSX.utils.book_new();
  const wsData = [headers];

  for (const row of results) {
    wsData.push([
      row.carrier,
      row.patente,
      row.unidad,
      row.arribo,
      row.call,
      row.inicioIBTMS,
      row.finIBTMS,
      row.totalShipments,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Aplicar colores a la columna Patente (col index 1 = B)
  results.forEach((row, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 1 }); // +1 por header
    if (!ws[cellRef]) return;

    let fgColor = null;
    if (row.matchType === 'fuzzy-high') fgColor = YELLOW;
    if (row.matchType === 'fuzzy-low') fgColor = RED;

    if (fgColor) {
      ws[cellRef].s = {
        fill: { patternType: 'solid', fgColor: { rgb: fgColor } },
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  XLSX.writeFile(wb, filename, { cellStyles: true });
}
