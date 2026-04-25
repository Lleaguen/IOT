import { normalize, toMs, toTimeOnly, groupInbounds, getEdCycles, buildRow } from './matcherHelpers';

/**
 * Verifica si dos strings son anagramas (mismos caracteres, distinto orden).
 */
function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  return a.split('').sort().join('') === b.split('').sort().join('');
}

/**
 * Paso 2: Match por anagrama para trucks sin match exacto.
 */
export function runAnagramMatch(noMatchTrucks, inboundMap, availableDockingKeys, dockingByPatente, dockingAllByPatente, usedDockingKeys, usedTMSKeys, processedInboundIds, markUsed, markTMSUsed) {
  const results = [];
  const stillUnmatched = [];

  for (const truckId of noMatchTrucks) {
    const truckNorm = normalize(truckId);
    
    // Saltar si ya fue usada
    if (usedTMSKeys.has(truckNorm)) {
      continue;
    }

    const anagramKey = availableDockingKeys.find(k => isAnagram(truckNorm, k));
    if (!anagramKey) {
      stillUnmatched.push(truckId);
      continue;
    }

    availableDockingKeys.splice(availableDockingKeys.indexOf(anagramKey), 1);
    markUsed(anagramKey);
    markTMSUsed(truckId);

    const dockingMatchRows = dockingAllByPatente[anagramKey] || [];
    const matchedPatente = dockingByPatente[anagramKey][0]['PATENTE'].trim();
    const rowConUnidad = dockingMatchRows.find(r => (r['TIPO DE VEHICULO'] || '').trim());
    const unidad = rowConUnidad ? rowConUnidad['TIPO DE VEHICULO'].trim() : '';

    const edCycles = getEdCycles(dockingMatchRows);
    const usedCycles = new Set();

    const inboundList = Object.entries(inboundMap[truckId]).map(([inboundId, data]) => ({
      inboundId, opened: toMs(data.openedStr), closed: toMs(data.closedStr),
      openedStr: data.openedStr, closedStr: data.closedStr,
      shipments: data.shipments.size, carrier: data.carrier,
    }));

    for (const group of groupInbounds(inboundList)) {
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

      if (matchedCycleIdx === -1) continue;
      usedCycles.add(matchedCycleIdx);

      const cycle = edCycles[matchedCycleIdx];
      const addRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
      const callRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');

      group.inboundIds.forEach(id => processedInboundIds.add(id));
      results.push(buildRow(
        truckId, group, unidad,
        addRow?.['Fecha y hora'] || '',
        toTimeOnly(callRow?.['Fecha y hora'] || ''),
        matchedPatente, 'fuzzy-high', 0.9
      ));
    }
  }

  return { results, stillUnmatched };
}
