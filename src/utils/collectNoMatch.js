import { toMs, toTimeOnly } from './matcherHelpers';

/**
 * Recolecta patentes TMS sin matchear (agrupadas por patente, no por inbound).
 */
export function collectNoMatchTMS(inboundMap, processedInboundIds) {
  const noMatchByPatente = new Map();
  
  for (const [truckId, inbounds] of Object.entries(inboundMap)) {
    const unprocessedInbounds = [];
    
    for (const [inboundId, data] of Object.entries(inbounds)) {
      if (!processedInboundIds.has(inboundId)) {
        unprocessedInbounds.push({
          inboundId,
          carrier: data.carrier || '',
          shipments: data.shipments.size,
          inicioIBTMS: toTimeOnly(data.openedStr),
          finIBTMS: toTimeOnly(data.closedStr),
          openedStr: data.openedStr,
        });
      }
    }
    
    if (unprocessedInbounds.length > 0) {
      noMatchByPatente.set(truckId, unprocessedInbounds);
    }
  }
  
  // Retornar una fila por patente (no por inbound)
  const result = [];
  for (const [truckId, inbounds] of noMatchByPatente.entries()) {
    const totalShipments = inbounds.reduce((sum, ib) => sum + ib.shipments, 0);
    const firstInbound = inbounds[0];
    
    result.push({
      patente: truckId,
      inboundId: inbounds.map(ib => ib.inboundId).join(', '),
      carrier: firstInbound.carrier,
      shipments: totalShipments,
      inicioIBTMS: firstInbound.inicioIBTMS,
      finIBTMS: inbounds[inbounds.length - 1].finIBTMS,
      openedStr: firstInbound.openedStr,
    });
  }
  
  return result;
}

/**
 * Recolecta patentes del ED sin matchear, una por descarga (deduplicando semis).
 */
export function collectNoMatchED(dockingByPatente, usedDockingKeys, dockingAllByPatente, keySiblings) {
  const result = [];
  const processedKeys = new Set();
  
  for (const key of Object.keys(dockingByPatente)) {
    if (usedDockingKeys.has(key) || processedKeys.has(key)) continue;
    
    // Marcar esta clave y sus siblings como procesadas
    processedKeys.add(key);
    if (keySiblings[key]) {
      keySiblings[key].forEach(k => processedKeys.add(k));
    }
    
    const allRows = dockingAllByPatente[key] || [];
    const addRow = allRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'add');
    const callRow = allRows.find(r => (r['Accion'] || '').trim().toLowerCase() === 'call');
    const firstRow = dockingByPatente[key][0];
    
    result.push({
      patente: firstRow['PATENTE'],
      cantPaquetes: firstRow['CANT PAQUETES'],
      unidad: (firstRow['TIPO DE VEHICULO'] || '').trim(),
      transporte: firstRow['TRANSPORTE'] || '',
      arribo: addRow ? addRow['Fecha y hora'] : '',
      call: callRow ? callRow['Fecha y hora'] : '',
    });
  }
  
  return result;
}
