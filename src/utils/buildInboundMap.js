import { isValidPatente } from './matcherHelpers';

const VALID_DOCK_MIN = 17;
const VALID_DOCK_MAX = 73;

function isValidDock(row) {
  const dockRaw = row['Inbound Dock ID'];
  if (dockRaw === null || dockRaw === undefined || String(dockRaw).trim() === '') return true;
  const dockNum = Number(String(dockRaw).trim());
  if (isNaN(dockNum)) return true;
  return dockNum >= VALID_DOCK_MIN && dockNum <= VALID_DOCK_MAX;
}

/**
 * Construye el mapa TMS: truckId -> inboundId -> { shipments, openedStr, closedStr, carrier }
 * Excluye filas con Dock ID fuera del rango 17-73 (docas ficticias).
 */
export function buildInboundMap(tmsRows) {
  const inboundMap = {};
  if (tmsRows.length > 0) {
    console.log('=== TMS headers reales ===', Object.keys(tmsRows[0]));
  }
  for (const row of tmsRows) {
    if (!isValidDock(row)) continue;
    const truckId = (row['Truck ID'] || '').trim();
    const inboundId = (row['Inbound ID'] || '').trim();
    const shipmentId = (row['Shipment ID'] || '').trim();
    if (!truckId || !inboundId || !isValidPatente(truckId)) continue;
    if (!inboundMap[truckId]) inboundMap[truckId] = {};
    if (!inboundMap[truckId][inboundId]) {
      inboundMap[truckId][inboundId] = {
        shipments: new Set(),
        openedStr: row['Inbound Date Opened'] || '',
        closedStr: row['Inbound Date Closed'] || '',
        carrier: row['Inbound Carrier Name'] || '',
      };
    }
    if (shipmentId) inboundMap[truckId][inboundId].shipments.add(shipmentId);
    if (!inboundMap[truckId][inboundId].carrier && row['Inbound Carrier Name']) {
      inboundMap[truckId][inboundId].carrier = row['Inbound Carrier Name'];
    }
  }
  return inboundMap;
}
