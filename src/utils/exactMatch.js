import { normalize, toMs, toTimeOnly, groupInbounds, getEdCycles, buildRow } from './matcherHelpers';

/**
 * Paso 1: Match exacto por patente.
 * Retorna { results, unmatchedGroups }
 * - results: filas matcheadas
 * - unmatchedGroups: grupos sin ciclo ED correspondiente → van al fuzzy
 */
export function runExactMatch(inboundMap, dockingByPatente, dockingAllByPatente, usedDockingKeys, usedTMSKeys, processedInboundIds, markUsed, markTMSUsed) {
  const results = [];
  const unmatchedGroups = [];

  for (const truckId of Object.keys(inboundMap)) {
    const truckNorm = normalize(truckId);
    
    // Saltar si ya fue usada esta patente TMS
    if (usedTMSKeys.has(truckNorm)) continue;
    
    if (!dockingByPatente[truckNorm] || usedDockingKeys.has(truckNorm)) continue;

    const dockingMatchRows = dockingAllByPatente[truckNorm] || [];
    const matchedPatente = dockingByPatente[truckNorm][0]['PATENTE'].trim();
    const rowConUnidad = dockingMatchRows.find(r => (r['TIPO DE VEHICULO'] || '').trim());
    const unidad = rowConUnidad ? rowConUnidad['TIPO DE VEHICULO'].trim() : '';

    const inboundList = Object.entries(inboundMap[truckId]).map(([inboundId, data]) => ({
      inboundId,
      opened: toMs(data.openedStr),
      closed: toMs(data.closedStr),
      openedStr: data.openedStr,
      closedStr: data.closedStr,
      shipments: data.shipments.size,
      carrier: data.carrier,
    }));

    const edCycles = getEdCycles(dockingMatchRows);
    const usedCycles = new Set();
    let anyMatched = false;

    for (const group of groupInbounds(inboundList)) {
      // Si todos los Inbound IDs del grupo ya fueron procesados, saltear
      if (group.inboundIds.every(id => processedInboundIds.has(id))) continue;

      let matchedCycleIdx = -1;
      if (group.opened !== null) {
        let bestDiff = Infinity;
        edCycles.forEach((cycle, idx) => {
          if (usedCycles.has(idx)) return;
          const callRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
          if (!callRow) return;
          const callMs = toMs(callRow['Fecha y hora']);
          if (callMs === null || callMs > group.opened) return;
          const diff = group.opened - callMs;
          if (diff < bestDiff) { bestDiff = diff; matchedCycleIdx = idx; }
        });
      }

      if (matchedCycleIdx === -1) {
        unmatchedGroups.push({ truckId, group });
        continue;
      }

      usedCycles.add(matchedCycleIdx);
      anyMatched = true;
      const cycle = edCycles[matchedCycleIdx];
      const addRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
      const callRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');

      group.inboundIds.forEach(id => processedInboundIds.add(id));
      results.push(buildRow(
        truckId, group, unidad,
        addRow?.['Fecha y hora'] || '',
        toTimeOnly(callRow?.['Fecha y hora'] || ''),
        matchedPatente, 'exact', 1
      ));
    }

    // Solo marcar como usada si al menos un grupo matcheó
    if (anyMatched) {
      markUsed(truckNorm);
      markTMSUsed(truckId);
    }
  }

  return { results, unmatchedGroups };
}
