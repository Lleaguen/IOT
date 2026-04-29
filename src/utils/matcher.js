import { normalize, toMs, toTimeOnly, groupInbounds, getEdCycles, buildRow } from './matcherHelpers';
import { buildDockingMaps } from './buildDockingMaps';
import { buildInboundMap } from './buildInboundMap';
import { levenshteinScore } from './levenshtein';
import { buildBSTIndex } from './bst';
import { bubbleSortCandidates } from './bubbleSort';
import { TIME_WINDOW_MS } from './matcherConstants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  return a.split('').sort().join('') === b.split('').sort().join('');
}

const STOP_WORDS = new Set([
  'sa', 'srl', 'sl', 'de', 'la', 'el', 'los', 'las', 'y', 'e', 'del',
  'transporte', 'transportes', 'logistica', 'logistics', 'cargo', 'express', 'group',
]);

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
  if (!a || !b) return true;
  const wordsA = new Set(a.split(' '));
  return b.split(' ').some(w => wordsA.has(w));
}

// Score de una patente TMS contra una key ED (que puede ser un semi con múltiples partes).
// Compara contra cada parte y retorna el score más alto junto con el tipo de match.
function scoreAgainstED(tmsNorm, edParts) {
  let bestScore = 0;
  let bestType = null;

  for (const part of edParts) {
    // Exact
    if (tmsNorm === part) return { score: 1.0, matchType: 'exact' };

    // Anagram
    if (isAnagram(tmsNorm, part)) {
      if (0.95 > bestScore) { bestScore = 0.95; bestType = 'anagram'; }
      continue;
    }

    // Levenshtein — umbral 0.3 para capturar patentes con varios caracteres distintos
    const lev = levenshteinScore(tmsNorm, part);
    if (lev >= 0.3 && lev > bestScore) {
      bestScore = lev;
      bestType = lev >= 0.8 ? 'fuzzy-high' : 'fuzzy-low';
    }
  }

  return bestScore > 0 ? { score: bestScore, matchType: bestType } : null;
}

function scoreMultiCriteria(tmsData, edRow, edAllRows) {
  const cantPaquetes = Number(edRow['CANT PAQUETES']);
  if (isNaN(cantPaquetes) || cantPaquetes !== tmsData.totalShipments) return 0;

  const callRow = edAllRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
  let horarioScore = 0;
  if (callRow && tmsData.openedMs !== null) {
    const callMs = toMs(callRow['Fecha y hora']);
    if (callMs !== null && callMs <= tmsData.openedMs) {
      const diff = tmsData.openedMs - callMs;
      if (diff <= TIME_WINDOW_MS) horarioScore = 1 - diff / TIME_WINDOW_MS;
    }
  }
  const transportistaScore = carriersMatch(tmsData.carrier, edRow['TRANSPORTE'] || '') ? 1 : 0;
  return horarioScore * 0.6 + transportistaScore * 0.4;
}

// ─── Construir filas de resultado para un conjunto de matches ─────────────────

function buildMatchResults(selectedMatches, inboundMap, dockingByPatente, dockingAllByPatente, processedInboundIds) {
  const results = [];

  for (const match of selectedMatches) {
    const { truckId, edKey, matchType, score } = match;
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

      let arribo = '', call = '';
      if (matchedCycleIdx !== -1) {
        usedCycles.add(matchedCycleIdx);
        const cycle = edCycles[matchedCycleIdx];
        const addRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
        const callRow = cycle.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
        arribo = addRow?.['Fecha y hora'] || '';
        call = toTimeOnly(callRow?.['Fecha y hora'] || '');
      } else {
        const addRow = dockingMatchRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
        const callRow = dockingMatchRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
        arribo = addRow?.['Fecha y hora'] || '';
        call = toTimeOnly(callRow?.['Fecha y hora'] || '');
      }

      group.inboundIds.forEach(id => processedInboundIds.add(id));
      results.push(buildRow(truckId, group, unidad, arribo, call, matchedPatente, matchType, score));
    }
  }

  return results;
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

export function matchData(tmsRows, dockingRows) {
  const { dockingByPatente, dockingAllByPatente, edKeyParts, keySiblings } = buildDockingMaps(dockingRows);
  const inboundMap = buildInboundMap(tmsRows);

  console.log('=== ADVANCED MATCHING ENGINE ===');
  console.log('TMS trucks:', Object.keys(inboundMap).length);
  console.log('ED keys:', Object.keys(dockingByPatente).length);

  const edKeys = Object.keys(dockingByPatente);

  // BST indexa cada parte individual de cada key ED.
  // Así "AH912KR;AF608EL" permite encontrar exacto por "AH912KR" o "AF608EL".
  // El mapa partToKey permite recuperar la key ED completa desde la parte.
  const partToKey = new Map();
  for (const key of edKeys) {
    for (const part of (edKeyParts[key] || [key])) {
      if (!partToKey.has(part)) partToKey.set(part, key);
    }
  }
  const bstIndex = buildBSTIndex([...partToKey.keys()]);

  const tmsEntries = Object.keys(inboundMap).map((truckId, idx) => {
    const inbounds = inboundMap[truckId];
    const firstInbound = Object.values(inbounds)[0];
    return {
      id: `TMS_${idx}`,
      truckId,
      normalized: normalize(truckId),
      totalShipments: Object.values(inbounds).reduce((s, d) => s + d.shipments.size, 0),
      openedMs: toMs(firstInbound?.openedStr),
      carrier: firstInbound?.carrier || '',
    };
  });

  const edEntries = edKeys.map((key, idx) => ({ id: `ED_${idx}`, key }));

  // ── FASE 1: Exact match via BST (score 1.0) — intocable ──────────────────
  const exactMatches = [];
  const usedTMS = new Set();
  const usedED = new Set();

  for (const tms of tmsEntries) {
    const hit = bstIndex.search(tms.normalized);
    if (!hit) continue;
    const edKey = partToKey.get(hit);
    if (!edKey) continue;
    const ed = edEntries.find(e => e.key === edKey);
    if (!ed || usedED.has(ed.id)) continue;

    usedTMS.add(tms.id);
    usedED.add(ed.id);
    if (keySiblings[ed.key]) {
      keySiblings[ed.key].forEach(sibKey => {
        const sib = edEntries.find(e => e.key === sibKey);
        if (sib) usedED.add(sib.id);
      });
    }
    exactMatches.push({ tmsId: tms.id, edId: ed.id, truckId: tms.truckId, edKey: ed.key, matchType: 'exact', score: 1.0 });
  }

  console.log('Exact matches:', exactMatches.length);

  // ── FASE 2: Todos los algoritmos sobre los residuos ───────────────────────
  // TMS y ED que NO matchearon exacto entran al pool multi-algoritmo
  const residualTMS = tmsEntries.filter(t => !usedTMS.has(t.id));
  const residualED = edEntries.filter(e => !usedED.has(e.id));

  const allCandidates = [];

  for (const tms of residualTMS) {
    for (const ed of residualED) {
      const parts = edKeyParts[ed.key] || [ed.key];

      // Exact via partes (por si el BST no lo capturó)
      if (parts.includes(tms.normalized)) {
        allCandidates.push({ tmsId: tms.id, edId: ed.id, truckId: tms.truckId, edKey: ed.key, matchType: 'exact', score: 1.0 });
        continue;
      }

      // Anagram + Levenshtein contra cada parte
      const result = scoreAgainstED(tms.normalized, parts);
      if (result) {
        allCandidates.push({ tmsId: tms.id, edId: ed.id, truckId: tms.truckId, edKey: ed.key, ...result });
        continue;
      }

      // Multi-criteria: piezas + horario + transportista (score > 0)
      const mcScore = scoreMultiCriteria(
        { totalShipments: tms.totalShipments, openedMs: tms.openedMs, carrier: tms.carrier },
        dockingByPatente[ed.key][0],
        dockingAllByPatente[ed.key] || []
      );
      if (mcScore > 0) {
        allCandidates.push({ tmsId: tms.id, edId: ed.id, truckId: tms.truckId, edKey: ed.key, matchType: 'multi-criteria', score: mcScore });
      }
    }
  }

  // Bubble Sort por score descendente
  bubbleSortCandidates(allCandidates);
  console.log('Candidatos residuales:', allCandidates.length);

  // Greedy selection sobre residuos
  const residualMatches = [];
  for (const candidate of allCandidates) {
    if (usedTMS.has(candidate.tmsId) || usedED.has(candidate.edId)) continue;
    usedTMS.add(candidate.tmsId);
    usedED.add(candidate.edId);
    if (keySiblings[candidate.edKey]) {
      keySiblings[candidate.edKey].forEach(sibKey => {
        const sib = edEntries.find(e => e.key === sibKey);
        if (sib) usedED.add(sib.id);
      });
    }
    residualMatches.push(candidate);
  }

  console.log('Residual matches:', residualMatches.length);

  const allSelectedMatches = [...exactMatches, ...residualMatches];

  // ── Construir filas de resultado ──────────────────────────────────────────
  const processedInboundIds = new Set();
  const matched = buildMatchResults(allSelectedMatches, inboundMap, dockingByPatente, dockingAllByPatente, processedInboundIds);

  // Claves ED usadas
  const usedDockingKeys = new Set();
  for (const match of allSelectedMatches) {
    usedDockingKeys.add(match.edKey);
    if (keySiblings[match.edKey]) keySiblings[match.edKey].forEach(k => usedDockingKeys.add(k));
  }

  // ── FASE 3: Time-window match sobre los residuos finales ──────────────────
  // Se ejecuta sobre lo que quedó sin match y SÍ descuenta de noMatch
  const usedEDForTime = new Set();
  const timeMatches = [];
  const processedByTime = new Set(); // inboundIds resueltos por timeMatch

  // Construir lista de TMS sin match (inbounds no procesados)
  const noMatchTMSRaw = [];
  for (const [truckId, inbounds] of Object.entries(inboundMap)) {
    const unprocessed = Object.entries(inbounds).filter(([id]) => !processedInboundIds.has(id));
    if (unprocessed.length === 0) continue;
    const totalShipments = unprocessed.reduce((s, [, d]) => s + d.shipments.size, 0);
    const firstInbound = unprocessed[0][1];
    noMatchTMSRaw.push({
      patente: truckId,
      inboundId: unprocessed.map(([id]) => id).join(', '),
      inboundIds: unprocessed.map(([id]) => id),
      carrier: firstInbound.carrier || '',
      shipments: totalShipments,
      inicioIBTMS: toTimeOnly(firstInbound.openedStr),
      finIBTMS: toTimeOnly(unprocessed[unprocessed.length - 1][1].closedStr),
      openedStr: firstInbound.openedStr,
    });
  }

  for (const tmsRow of noMatchTMSRaw) {
    const tmsOpenedMs = toMs(tmsRow.openedStr);
    if (tmsOpenedMs === null) continue;

    let bestDiff = Infinity, bestEDKey = null;
    for (const edKey of edKeys) {
      if (usedDockingKeys.has(edKey) || usedEDForTime.has(edKey)) continue;
      const callRow = (dockingAllByPatente[edKey] || []).find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
      if (!callRow) continue;
      const callMs = toMs(callRow['Fecha y hora']);
      if (callMs === null || callMs > tmsOpenedMs) continue;
      const diff = tmsOpenedMs - callMs;
      if (diff > TIME_WINDOW_MS) continue;
      if (diff < bestDiff) { bestDiff = diff; bestEDKey = edKey; }
    }

    if (!bestEDKey) continue;

    // Este TMS matcheó por tiempo → se descuenta de noMatch
    usedEDForTime.add(bestEDKey);
    usedDockingKeys.add(bestEDKey);
    tmsRow.inboundIds.forEach(id => processedByTime.add(id));

    const edRow = dockingByPatente[bestEDKey][0];
    const callRow = (dockingAllByPatente[bestEDKey] || []).find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
    timeMatches.push({
      patenteTMS: tmsRow.patente,
      inboundId: tmsRow.inboundId,
      patenteED: edRow['PATENTE'],
      carrier: tmsRow.carrier,
      unidad: (edRow['TIPO DE VEHICULO'] || '').trim(),
      callED: toTimeOnly(callRow?.['Fecha y hora'] || ''),
      inicioIBTMS: tmsRow.inicioIBTMS,
      finIBTMS: tmsRow.finIBTMS,
      totalShipments: tmsRow.shipments,
      cantPaquetesED: edRow['CANT PAQUETES'],
      diffMinutos: Math.round(bestDiff / 60000),
    });
  }

  // ── noMatch final: excluye lo resuelto por timeMatch ─────────────────────
  const allProcessed = new Set([...processedInboundIds, ...processedByTime]);

  const noMatchTMS = noMatchTMSRaw.filter(r => r.inboundIds.some(id => !allProcessed.has(id)));

  // noMatch ED: excluye claves usadas en exact+residual+time
  const processedEDKeys = new Set();
  const noMatchED = [];
  for (const key of edKeys) {
    if (usedDockingKeys.has(key) || processedEDKeys.has(key)) continue;
    processedEDKeys.add(key);
    if (keySiblings[key]) keySiblings[key].forEach(k => processedEDKeys.add(k));
    const allRows = dockingAllByPatente[key] || [];
    const addRow = allRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
    const callRow = allRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
    const firstRow = dockingByPatente[key][0];
    noMatchED.push({
      patente: firstRow['PATENTE'],
      cantPaquetes: firstRow['CANT PAQUETES'],
      unidad: (firstRow['TIPO DE VEHICULO'] || '').trim(),
      transporte: firstRow['TRANSPORTE'] || '',
      arribo: addRow ? addRow['Fecha y hora'] : '',
      call: callRow ? callRow['Fecha y hora'] : '',
    });
  }

  console.log('=== RESULTADOS ===');
  console.log('Matched:', matched.length, '| Time matches:', timeMatches.length, '| NoMatch TMS:', noMatchTMS.length, '| NoMatch ED:', noMatchED.length);

  return { matched, noMatchTMS, noMatchED, timeMatches };
}
