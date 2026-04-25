import { levenshteinScore } from './levenshtein';
import { normalize, toMs, toTimeOnly, groupInbounds, buildRow } from './matcherHelpers';

function findBestFuzzyKey(truckNorm, inboundMap, truckId, availableDockingKeys, dockingByPatente, dockingAllByPatente) {
  let bestScore = 0;
  let bestKey = null;
  for (const key of availableDockingKeys) {
    const s = levenshteinScore(truckNorm, key);
    if (s <= bestScore) continue;
    const addRow = (dockingAllByPatente[key] || []).find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
    if (addRow) {
      const arriboMs = toMs(addRow['Fecha y hora']);
      const firstInbound = Object.values(inboundMap[truckId] || {})[0];
      const inboundOpenedMs = firstInbound ? toMs(firstInbound.openedStr) : null;
      if (arriboMs !== null && inboundOpenedMs !== null && arriboMs > inboundOpenedMs) continue;
    }
    bestScore = s;
    bestKey = key;
  }
  return { bestScore, bestKey };
}

/**
 * Paso 2: Levenshtein para trucks sin match exacto.
 */
export function runFuzzyMatch(noMatchTrucks, inboundMap, availableDockingKeys, dockingByPatente, dockingAllByPatente, usedDockingKeys, usedTMSKeys, processedInboundIds, markUsed, markTMSUsed) {
  const results = [];
  for (const truckId of noMatchTrucks) {
    const truckNorm = normalize(truckId);
    
    // Saltar si ya fue usada
    if (usedTMSKeys.has(truckNorm)) continue;
    
    const totalTmsShipments = Object.values(inboundMap[truckId]).reduce((s, d) => s + d.shipments.size, 0);
    const { bestScore, bestKey } = findBestFuzzyKey(truckNorm, inboundMap, truckId, availableDockingKeys, dockingByPatente, dockingAllByPatente);
    if (!bestKey || bestScore === 0) continue;

    availableDockingKeys.splice(availableDockingKeys.indexOf(bestKey), 1);
    markUsed(bestKey);
    markTMSUsed(truckId);

    const dockingMatchRows = dockingAllByPatente[bestKey] || [];
    const matchedPatente = dockingByPatente[bestKey][0]['PATENTE'].trim();
    const matchType = bestScore >= 0.8 ? 'fuzzy-high' : 'fuzzy-low';
    const rowConUnidad = dockingMatchRows.find(r => (r['TIPO DE VEHICULO'] || '').trim());
    const unidad = rowConUnidad ? rowConUnidad['TIPO DE VEHICULO'].trim() : '';

    const inboundList = Object.entries(inboundMap[truckId]).map(([inboundId, data]) => ({
      inboundId, opened: toMs(data.openedStr), closed: toMs(data.closedStr),
      openedStr: data.openedStr, closedStr: data.closedStr,
      shipments: data.shipments.size, carrier: data.carrier,
    }));

    for (const group of groupInbounds(inboundList)) {
      let arribo = '', call = '';
      if (group.opened !== null) {
        let bestArriboDiff = Infinity, bestCallDiff = Infinity;
        for (const dr of dockingMatchRows) {
          const accion = (dr['Accion'] || '').trim().toLowerCase();
          const fechaMs = toMs(dr['Fecha y hora']);
          if (fechaMs === null) continue;
          const diff = Math.abs(fechaMs - group.opened);
          if (accion === 'add' && diff < bestArriboDiff) { bestArriboDiff = diff; arribo = dr['Fecha y hora'] || ''; }
          if (accion === 'call' && diff < bestCallDiff) { bestCallDiff = diff; call = toTimeOnly(dr['Fecha y hora'] || ''); }
        }
      }
      group.inboundIds.forEach(id => processedInboundIds.add(id));
      results.push(buildRow(truckId, group, unidad, arribo, call, matchedPatente, matchType, bestScore));
    }
  }
  return results;
}

/**
 * Paso 2b: Levenshtein para grupos sin ciclo ED del paso exacto.
 */
export function runFuzzyMatchGroups(unmatchedGroups, inboundMap, availableDockingKeys, dockingByPatente, dockingAllByPatente, usedDockingKeys, usedTMSKeys, processedInboundIds, markUsed, markTMSUsed) {
  const results = [];
  for (const { truckId, group } of unmatchedGroups) {
    const truckNorm = normalize(truckId);
    
    // Saltar si ya fue usada
    if (usedTMSKeys.has(truckNorm)) continue;
    
    let bestScore = 0, bestKey = null;
    for (const key of availableDockingKeys) {
      const s = levenshteinScore(truckNorm, key);
      if (s <= bestScore) continue;
      const callRow = (dockingAllByPatente[key] || []).find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
      if (callRow && group.opened !== null) {
        const callMs = toMs(callRow['Fecha y hora']);
        if (callMs !== null && callMs > group.opened) continue;
      }
      bestScore = s;
      bestKey = key;
    }
    if (!bestKey || bestScore === 0) continue;

    availableDockingKeys.splice(availableDockingKeys.indexOf(bestKey), 1);
    markUsed(bestKey);
    markTMSUsed(truckId);

    const dockingMatchRows = dockingAllByPatente[bestKey] || [];
    const matchedPatente = dockingByPatente[bestKey][0]['PATENTE'].trim();
    const matchType = bestScore >= 0.8 ? 'fuzzy-high' : 'fuzzy-low';
    const rowConUnidad = dockingMatchRows.find(r => (r['TIPO DE VEHICULO'] || '').trim());
    const unidad = rowConUnidad ? rowConUnidad['TIPO DE VEHICULO'].trim() : '';
    const callRow = dockingMatchRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
    const addRow = dockingMatchRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');

    group.inboundIds.forEach(id => processedInboundIds.add(id));
    results.push(buildRow(
      truckId, group, unidad,
      addRow?.['Fecha y hora'] || '',
      toTimeOnly(callRow?.['Fecha y hora'] || ''),
      matchedPatente, matchType, bestScore
    ));
  }
  return results;
}
