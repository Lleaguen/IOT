import React from 'react';

export default function VehicleCounter({ results }) {
  if (!results?.length) return null;

  const counts = results.reduce((acc, r) => {
    const tipo = (r.unidad || '').toLowerCase();
    if (tipo.includes('semi')) acc.semi++;
    else if (tipo.includes('camioneta')) acc.camioneta++;
    else if (tipo.includes('chasis')) acc.chasis++;
    else acc.otro++;
    return acc;
  }, { semi: 0, camioneta: 0, chasis: 0, otro: 0 });

  return (
    <div className="vehicle-counter">
      <span className="vc-item">🚛 Semi: {counts.semi}</span>
      <span className="vc-item">🚐 Camioneta: {counts.camioneta}</span>
      <span className="vc-item">🚚 Chasis: {counts.chasis}</span>
      {counts.otro > 0 && <span className="vc-item">📦 Otro: {counts.otro}</span>}
    </div>
  );
}
