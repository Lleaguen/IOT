import { isValidPatente, normalize, splitPatentes, getEdCycles } from './matcherHelpers';

/**
 * Construye mapas del ED usando la patente RAW como key única.
 * Para semis ("AH912KR; AF608EL"), NO se divide en keys separadas.
 * En cambio, se guarda la lista de partes normalizadas para que el matcher
 * compare la patente TMS contra cada parte y tome el score más alto.
 *
 * - dockingByPatente: key (patente raw normalizada) -> filas Descarga+add
 * - dockingAllByPatente: key -> todas las filas
 * - edKeyParts: key -> array de patentes normalizadas individuales (para matching)
 */
export function buildDockingMaps(dockingRows) {
  const dockingByPatente = {};
  const dockingAllByPatente = {};
  const edKeyParts = {}; // key -> [normalized part1, normalized part2, ...]
  const keyCycleCount = {};

  for (const row of dockingRows) {
    const patRaw = (row['PATENTE'] || '').trim();
    if (!patRaw) continue;

    // Usar la patente raw completa como key única (normalizada sin espacios/guiones)
    // Para semis "AH912KR; AF608EL" la key es "AH912KR;AF608EL"
    const key = normalize(patRaw);
    if (!key) continue;

    // Guardar las partes individuales para el matching
    const pats = splitPatentes(patRaw);
    const validParts = pats.filter(p => isValidPatente(p)).map(p => normalize(p));
    // Si no hay partes válidas, intentar usar la key completa como parte
    edKeyParts[key] = validParts.length > 0 ? validParts : [key];

    if (!dockingAllByPatente[key]) dockingAllByPatente[key] = [];
    dockingAllByPatente[key].push(row);

    const operacion = (row['TIPO DE OPERACION'] || '').trim().toLowerCase();
    const accion = (row['Accion'] || '').trim().toLowerCase();
    if (operacion === 'descarga' && accion === 'add') {
      if (!dockingByPatente[key]) dockingByPatente[key] = [];
      dockingByPatente[key].push(row);
    }
  }

  // Calcular ciclos disponibles por key
  for (const key of Object.keys(dockingAllByPatente)) {
    const cycles = getEdCycles(dockingAllByPatente[key]);
    keyCycleCount[key] = cycles.length || 1;

    // Si la key tiene datos pero no tiene filas descarga+add,
    // agregarla igual a dockingByPatente usando la primera fila disponible.
    // Esto evita que patentes ED sin accion=add queden fuera del pool de matching.
    if (!dockingByPatente[key]) {
      dockingByPatente[key] = [dockingAllByPatente[key][0]];
    }
  }

  // keySiblings ya no es necesario — no hay keys duplicadas por semi
  const keySiblings = {};

  return { dockingByPatente, dockingAllByPatente, edKeyParts, keySiblings, keyCycleCount };
}
