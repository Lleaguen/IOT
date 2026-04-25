import { toMs, toTimeOnly } from './matcherHelpers';
import { TIME_WINDOW_MS } from './matcherConstants';

/**
 * Paso 3: Matcheo por horario.
 * Compara call del ED con Inicio IB TMS. Ventana: 30 min.
 */
export function runTimeMatch(noMatchTMS, dockingByPatente, dockingAllByPatente, usedDockingKeys) {
  const usedEDForTime = new Set();
  const timeMatches = [];

  for (const tmsRow of noMatchTMS) {
    const tmsOpenedMs = toMs(tmsRow.openedStr);
    if (tmsOpenedMs === null) continue;

    let bestDiff = Infinity, bestEDKey = null;
    for (const edKey of Object.keys(dockingByPatente).filter(k => !usedDockingKeys.has(k) && !usedEDForTime.has(k))) {
      const callRow = (dockingAllByPatente[edKey] || []).find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
      if (!callRow) continue;
      const callMs = toMs(callRow['Fecha y hora']);
      if (callMs === null || callMs > tmsOpenedMs) continue;
      const diff = tmsOpenedMs - callMs;
      if (diff > TIME_WINDOW_MS) continue;
      if (diff < bestDiff) { bestDiff = diff; bestEDKey = edKey; }
    }

    if (!bestEDKey) continue;
    usedEDForTime.add(bestEDKey);

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

  return timeMatches;
}
