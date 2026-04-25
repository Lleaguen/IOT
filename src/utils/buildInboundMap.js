import { isValidPatente } from './matcherHelpers';

/**
 * Construye el mapa TMS: truckId -> inboundId -> { shipments, openedStr, closedStr, carrier }
 */
export function buildInboundMap(tmsRows) {
  const inboundMap = {};
  for (const row of tmsRows) {
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
