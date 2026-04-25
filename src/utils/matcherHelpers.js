import { PATENTE_VIEJA, PATENTE_NUEVA, PATENTES_FICTICIAS, SPLIT_THRESHOLD_MS } from './matcherConstants';

export const normalize = (s) => (s || '').trim().toUpperCase().replace(/[\s\-]/g, '');

export function isValidPatente(s) {
  const clean = (s || '').trim().replace(/[\s-]/g, '');
  if (PATENTES_FICTICIAS.has(clean.toLowerCase())) return false;
  return PATENTE_VIEJA.test(clean) || PATENTE_NUEVA.test(clean);
}

export function toMs(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.trim();
  let d;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [datePart, timePart] = s.split(' ');
    const [dd, mm, yyyy] = datePart.split('/');
    d = new Date(`${yyyy}-${mm}-${dd}T${timePart || '00:00:00'}`);
  } else {
    d = new Date(s.replace(' ', 'T'));
  }
  return isNaN(d.getTime()) ? null : d.getTime();
}

export function toTimeOnly(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.trim().split(' ');
  return parts.length >= 2 ? parts[1] : dateStr;
}

export function groupInbounds(inboundList) {
  const sorted = [...inboundList].sort((a, b) => (a.opened || 0) - (b.opened || 0));
  const groups = [];
  for (const inbound of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.closed !== null &&
      inbound.opened !== null &&
      inbound.opened - last.closed <= SPLIT_THRESHOLD_MS
    ) {
      last.shipments += inbound.shipments;
      last.closed = inbound.closed ?? last.closed;
      last.closedStr = inbound.closedStr || last.closedStr;
      last.inboundIds.push(inbound.inboundId);
    } else {
      groups.push({
        inboundIds: [inbound.inboundId],
        opened: inbound.opened,
        closed: inbound.closed,
        openedStr: inbound.openedStr,
        closedStr: inbound.closedStr,
        shipments: inbound.shipments,
        carrier: inbound.carrier,
      });
    }
  }
  return groups;
}

export function getEdCycles(dockingMatchRows) {
  const cycles = [];
  let current = [];
  for (const dr of dockingMatchRows) {
    const accion = (dr['Accion'] || '').trim().toLowerCase();
    if (accion === 'add' && current.length > 0) { cycles.push(current); current = []; }
    current.push(dr);
  }
  if (current.length > 0) cycles.push(current);
  return cycles;
}

export function buildRow(truckId, group, unidad, arribo, call, matchedPatente, matchType, score) {
  // Para semis, mostrar el formato original del ED (ej: "AF742YI; enm010")
  const isSemi = matchedPatente && (matchedPatente.includes(';') || matchedPatente.includes(' '));
  const patenteDisplay = isSemi ? matchedPatente : truckId;

  return {
    carrier: group.carrier || '',
    patente: patenteDisplay,
    patenteTMS: truckId,
    unidad,
    arribo,
    call,
    inicioIBTMS: toTimeOnly(group.openedStr),
    finIBTMS: toTimeOnly(group.closedStr),
    totalShipments: group.shipments,
    matchType,
    matchedPatente,
    score,
    inboundIds: group.inboundIds,
  };
}

export function splitPatentes(patRaw) {
  if (patRaw.includes(';')) return patRaw.split(';').map(p => p.trim()).filter(Boolean);
  const tokens = patRaw.trim().split(/\s+/).filter(t => isValidPatente(t));
  return tokens.length > 1 ? tokens : [patRaw.trim()];
}
