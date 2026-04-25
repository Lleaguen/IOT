import { normalize, toMs, toTimeOnly, groupInbounds, getEdCycles, buildRow } from './matcherHelpers';
import { TIME_WINDOW_MS } from './matcherConstants';

/**
 * Normaliza un nombre de transportista para comparación.
 * Extrae palabras clave ignorando palabras genéricas.
 */
const STOP_WORDS = new Set(['sa', 'srl', 'sl', 'de', 'la', 'el', 'los', 'las', 'y', 'e', 'del', 'transporte', 'transportes', 'logistica', 'logistics', 'cargo', 'express', 'group']);

function normalizeCarrier(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w && !STOP_WORDS.has(w))
    .sort()
    .join(' ');
}

function carriersMatch(carrierTMS, transporteED) {
  const a = normalizeCarrier(carrierTMS);
  const b = normalizeCarrier(transporteED);
  if (!a || !b) return true; // si alguno está vacío, no penalizar
  // Coincidencia si comparten al menos una palabra clave
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  return [...wordsA].some(w => wordsB.has(w));
}

/**
 * Paso 4: Match por cantidad de piezas + proximidad de horario + transportista.
 * Para trucks que no matchearon por exacto, anagrama ni Levenshtein.
 */
export function runMultiCriteriaMatch(noMatchTrucks, inboundMap, availableDockingKeys, dockingByPatente, dockingAllByPatente, usedDockingKeys, usedTMSKeys, processedInboundIds, markUsed, markTMSUsed) {
  const results = [];

  for (const truckId of noMatchTrucks) {
    const truckNorm = normalize(truckId);
    
    // Saltar si ya fue usada
    if (usedTMSKeys.has(truckNorm)) continue;
    
    const inbounds = inboundMap[truckId];
    const totalShipments = Object.values(inbounds).reduce((s, d) => s + d.shipments.size, 0);
    const firstInbound = Object.values(inbounds)[0];
    const tmsOpenedMs = toMs(firstInbound?.openedStr);
    const carrierTMS = firstInbound?.carrier || '';

    let bestScore = -1;
    let bestKey = null;

    for (const key of availableDockingKeys) {
      const edRow = dockingByPatente[key][0];
      const cantPaquetes = Number(edRow['CANT PAQUETES']);
      const transporteED = edRow['TRANSPORTE'] || '';

      // Criterio 1: cantidad de piezas
      const piezasMatch = !isNaN(cantPaquetes) && cantPaquetes === totalShipments;
      if (!piezasMatch) continue;

      // Criterio 2: proximidad de horario (call del ED dentro de 30 min del TMS opened)
      const callRow = (dockingAllByPatente[key] || []).find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
      let horarioScore = 0;
      if (callRow && tmsOpenedMs !== null) {
        const callMs = toMs(callRow['Fecha y hora']);
        if (callMs !== null && callMs <= tmsOpenedMs) {
          const diff = tmsOpenedMs - callMs;
          if (diff <= TIME_WINDOW_MS) horarioScore = 1 - diff / TIME_WINDOW_MS;
        }
      }

      // Criterio 3: transportista
      const transportistaMatch = carriersMatch(carrierTMS, transporteED) ? 1 : 0;

      const score = horarioScore * 0.6 + transportistaMatch * 0.4;
      if (score > bestScore) { bestScore = score; bestKey = key; }
    }

    if (!bestKey || bestScore <= 0) continue;

    availableDockingKeys.splice(availableDockingKeys.indexOf(bestKey), 1);
    markUsed(bestKey);
    markTMSUsed(truckId);

    const dockingMatchRows = dockingAllByPatente[bestKey] || [];
    const matchedPatente = dockingByPatente[bestKey][0]['PATENTE'].trim();
    const matchType = bestScore >= 0.6 ? 'fuzzy-high' : 'fuzzy-low';
    const rowConUnidad = dockingMatchRows.find(r => (r['TIPO DE VEHICULO'] || '').trim());
    const unidad = rowConUnidad ? rowConUnidad['TIPO DE VEHICULO'].trim() : '';

    const edCycles = getEdCycles(dockingMatchRows);
    const usedCycles = new Set();

    const inboundList = Object.entries(inbounds).map(([inboundId, data]) => ({
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
        matchedPatente, matchType, bestScore
      ));
    }
  }

  return results;
}
