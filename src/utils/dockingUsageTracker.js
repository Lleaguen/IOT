import { getEdCycles } from './matcherHelpers';

/**
 * Trackea el uso de filas del ED por ID de registro.
 * Una fila puede usarse tantas veces como ciclos tenga.
 * Cuando se agotan los ciclos, todas sus keys quedan bloqueadas.
 */
export function createDockingTracker(dockingAllByPatente, keySiblings) {
  // rowId -> ciclos usados
  const rowUsage = {};
  // rowId -> total de ciclos disponibles
  const rowCycles = {};
  // key -> rowId (para saber a qué fila pertenece cada key)
  const keyToRowId = {};

  // Calcular ciclos por fila
  for (const [key, rows] of Object.entries(dockingAllByPatente)) {
    for (const row of rows) {
      const rowId = row['ID Registro'] || row['PATENTE'];
      if (!rowId) continue;
      keyToRowId[key] = rowId;
      if (!rowCycles[rowId]) {
        rowCycles[rowId] = getEdCycles(rows).length || 1;
        rowUsage[rowId] = 0;
      }
    }
  }

  function isKeyAvailable(key) {
    const rowId = keyToRowId[key];
    if (!rowId) return true;
    return (rowUsage[rowId] || 0) < (rowCycles[rowId] || 1);
  }

  function markKeyUsed(key) {
    const rowId = keyToRowId[key];
    if (!rowId) return;
    rowUsage[rowId] = (rowUsage[rowId] || 0) + 1;
  }

  // Interfaz compatible con Set para los módulos existentes
  const usedDockingKeys = {
    has: (key) => !isKeyAvailable(key),
    add: (key) => markKeyUsed(key),
    forEach: () => {},
    keys: () => Object.keys(keyToRowId).filter(k => !isKeyAvailable(k)),
  };

  return { usedDockingKeys, isKeyAvailable, markKeyUsed };
}
