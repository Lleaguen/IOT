import { isValidPatente, normalize, splitPatentes, getEdCycles } from './matcherHelpers';

/**
 * Construye mapas del ED:
 * - dockingByPatente: solo filas Descarga + add (para matcheo)
 * - dockingAllByPatente: todas las filas (para datos)
 * - keySiblings: dado una key, devuelve todas las keys de la misma fila
 * - keyCycleCount: cuántos ciclos (add/call) tiene cada key — define cuántas veces puede matchear
 */
export function buildDockingMaps(dockingRows) {
  const dockingByPatente = {};
  const dockingAllByPatente = {};
  const keySiblings = {};
  const keyCycleCount = {}; // key -> número de ciclos disponibles

  for (const row of dockingRows) {
    const patRaw = (row['PATENTE'] || '').trim();
    if (!patRaw) continue;
    const pats = splitPatentes(patRaw);
    const validKeys = pats.filter(p => isValidPatente(p)).map(p => normalize(p));

    for (const key of validKeys) {
      if (!dockingAllByPatente[key]) dockingAllByPatente[key] = [];
      dockingAllByPatente[key].push(row);
      const operacion = (row['TIPO DE OPERACION'] || '').trim().toLowerCase();
      const accion = (row['Accion'] || '').trim().toLowerCase();
      if (operacion === 'descarga' && accion === 'add') {
        if (!dockingByPatente[key]) dockingByPatente[key] = [];
        dockingByPatente[key].push(row);
      }
      if (!keySiblings[key]) keySiblings[key] = new Set();
      validKeys.forEach(k => keySiblings[key].add(k));
    }
  }

  // Calcular ciclos disponibles por key
  for (const key of Object.keys(dockingAllByPatente)) {
    const cycles = getEdCycles(dockingAllByPatente[key]);
    keyCycleCount[key] = cycles.length || 1;
  }

  return { dockingByPatente, dockingAllByPatente, keySiblings, keyCycleCount };
}
