import { normalize } from './matcherHelpers';
import { buildDockingMaps } from './buildDockingMaps';
import { buildInboundMap } from './buildInboundMap';
import { levenshteinScore } from './levenshtein';
import { collectNoMatchTMS, collectNoMatchED } from './collectNoMatch';
import { runTimeMatch } from './timeMatch';
import { toMs, toTimeOnly, groupInbounds, getEdCycles, buildRow } from './matcherHelpers';

function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  return a.split('').sort().join('') === b.split('').sort().join('');
}

export function matchData(tmsRows, dockingRows) {
  const { dockingByPatente, dockingAllByPatente, keySiblings } = buildDockingMaps(dockingRows);
  const inboundMap = buildInboundMap(tmsRows);

  console.log('=== INICIO MATCHING ===');
  console.log('Total TMS trucks:', Object.keys(inboundMap).length);
  console.log('Total ED keys:', Object.keys(dockingByPatente).length);

  // Crear IDs únicos para cada patente
  const tmsPatentes = Object.keys(inboundMap).map((truckId, idx) => ({
    id: `TMS_${idx}`,
    truckId,
    normalized: normalize(truckId),
    used: false
  }));

  const edPatentes = Object.keys(dockingByPatente).map((key, idx) => ({
    id: `ED_${idx}`,
    key,
    normalized: key,
    used: false
  }));

  // Evaluar TODAS las combinaciones posibles
  const allCandidates = [];
  
  for (const tms of tmsPatentes) {
    for (const ed of edPatentes) {
      let matchType = null;
      let score = 0;

      // 1. Exact match
      if (tms.normalized === ed.normalized) {
        matchType = 'exact';
        score = 1.0;
      }
      // 2. Anagram match
      else if (isAnagram(tms.normalized, ed.normalized)) {
        matchType = 'anagram';
        score = 0.95;
      }
      // 3. Fuzzy match
      else {
        const fuzzyScore = levenshteinScore(tms.normalized, ed.normalized);
        if (fuzzyScore >= 0.5) {
          matchType = fuzzyScore >= 0.8 ? 'fuzzy-high' : 'fuzzy-low';
          score = fuzzyScore;
        }
      }

      if (matchType) {
        allCandidates.push({
          tmsId: tms.id,
          edId: ed.id,
          truckId: tms.truckId,
          edKey: ed.key,
          matchType,
          score
        });
      }
    }
  }

  // Ordenar por score descendente
  allCandidates.sort((a, b) => b.score - a.score);

  console.log('Total candidates:', allCandidates.length);

  // Seleccionar los mejores matches sin reutilizar
  const usedTMS = new Set();
  const usedED = new Set();
  const selectedMatches = [];

  for (const candidate of allCandidates) {
    if (usedTMS.has(candidate.tmsId) || usedED.has(candidate.edId)) {
      continue;
    }

    usedTMS.add(candidate.tmsId);
    usedED.add(candidate.edId);
    
    // Marcar también los siblings (semis con múltiples patentes)
    if (keySiblings[candidate.edKey]) {
      keySiblings[candidate.edKey].forEach(siblingKey => {
        const siblingED = edPatentes.find(e => e.key === siblingKey);
        if (siblingED) {
          usedED.add(siblingED.id);
        }
      });
    }
    
    selectedMatches.push(candidate);
  }

  console.log('Selected matches:', selectedMatches.length);

  // Construir resultados finales
  const results = [];
  const processedInboundIds = new Set();
  const matchedTMSPatentes = new Map(); // Para debugging

  for (const match of selectedMatches) {
    const truckId = match.truckId;
    const edKey = match.edKey;

    const dockingMatchRows = dockingAllByPatente[edKey] || [];
    const matchedPatente = dockingByPatente[edKey][0]['PATENTE'].trim();
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
    
    let groupsMatched = 0;

    for (const group of groupInbounds(inboundList)) {
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
        // Sin ciclo ED, usar datos aproximados
        const addRow = dockingMatchRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
        const callRow = dockingMatchRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
        
        group.inboundIds.forEach(id => processedInboundIds.add(id));
        results.push(buildRow(
          truckId, group, unidad,
          addRow?.['Fecha y hora'] || '',
          toTimeOnly(callRow?.['Fecha y hora'] || ''),
          matchedPatente, match.matchType, match.score
        ));
        groupsMatched++;
        continue;
      }

      usedCycles.add(matchedCycleIdx);
      const cycle = edCycles[matchedCycleIdx];
      const addRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
      const callRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');

      group.inboundIds.forEach(id => processedInboundIds.add(id));
      results.push(buildRow(
        truckId, group, unidad,
        addRow?.['Fecha y hora'] || '',
        toTimeOnly(callRow?.['Fecha y hora'] || ''),
        matchedPatente, match.matchType, match.score
      ));
      groupsMatched++;
    }
    
    // Tracking para debugging
    if (!matchedTMSPatentes.has(truckId)) {
      matchedTMSPatentes.set(truckId, []);
    }
    matchedTMSPatentes.get(truckId).push({ edKey, groups: groupsMatched });
  }
  
  // Log patentes TMS que matchearon múltiples veces
  const duplicateTMS = [];
  for (const [truckId, matches] of matchedTMSPatentes.entries()) {
    if (matches.length > 1) {
      duplicateTMS.push({ truckId, matches });
    }
  }
  
  if (duplicateTMS.length > 0) {
    console.warn('PATENTES TMS QUE MATCHEARON MÚLTIPLES VECES:', duplicateTMS);
  }

  // Marcar las claves ED usadas para collectNoMatch (incluyendo siblings)
  const usedDockingKeys = new Set();
  for (const match of selectedMatches) {
    usedDockingKeys.add(match.edKey);
    if (keySiblings[match.edKey]) {
      keySiblings[match.edKey].forEach(k => usedDockingKeys.add(k));
    }
  }

  const noMatchTMS = collectNoMatchTMS(inboundMap, processedInboundIds);
  const noMatchED = collectNoMatchED(dockingByPatente, usedDockingKeys, dockingAllByPatente, keySiblings);
  
  console.log('\n=== TMS SIN MATCH DETALLADO ===');
  noMatchTMS.forEach(r => {
    console.log(`${r.patente}: ${r.shipments} piezas, carrier: ${r.carrier}, inicio: ${r.inicioIBTMS}`);
  });
  
  console.log('\n=== ED SIN MATCH DETALLADO ===');
  noMatchED.forEach(r => {
    console.log(`${r.patente}: ${r.cantPaquetes} piezas, transporte: ${r.transporte}, arribo: ${r.arribo}`);
  });

  console.log('\n=== RESULTADOS FINALES ===');
  console.log('Total matched:', results.length);
  console.log('TMS: 351 trucks, matched:', selectedMatches.length, ', sin match:', 351 - selectedMatches.length);
  console.log('ED: 370 keys, matched:', usedDockingKeys.size, ', sin match:', 370 - usedDockingKeys.size);
  console.log('Sin match TMS (patentes únicas):', noMatchTMS.length);
  console.log('Sin match ED (patentes únicas):', noMatchED.length);
  
  // Debugging: buscar patentes TMS con muchas piezas
  const highShipmentMatches = results.filter(r => r.totalShipments > 4000);
  if (highShipmentMatches.length > 0) {
    console.log('MATCHES CON MÁS DE 4000 PIEZAS:', highShipmentMatches.map(r => ({
      patenteTMS: r.patenteTMS,
      patenteED: r.matchedPatente,
      piezas: r.totalShipments,
      matchType: r.matchType,
      score: r.score
    })));
  }
  
  // Debugging: ver qué claves ED no están en noMatchED
  const edKeysNotMatched = Object.keys(dockingByPatente).filter(k => !usedDockingKeys.has(k));
  console.log('ED keys sin match (raw):', edKeysNotMatched.length);
  if (edKeysNotMatched.length !== noMatchED.length) {
    console.warn('DISCREPANCIA: ED keys sin match raw vs filtered:', edKeysNotMatched.length, 'vs', noMatchED.length);
    console.warn('Diferencia:', edKeysNotMatched.length - noMatchED.length, 'patentes filtradas');
  }

  const timeMatches = runTimeMatch(noMatchTMS, dockingByPatente, dockingAllByPatente, usedDockingKeys);

  return { matched: results, noMatchTMS, noMatchED, timeMatches };
}
