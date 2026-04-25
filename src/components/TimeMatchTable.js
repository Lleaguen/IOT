import React from 'react';

export default function TimeMatchTable({ rows }) {
  if (!rows?.length) return <p className="empty-msg">No hay matcheos por horario.</p>;
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>Patente TMS</th>
          <th>Inbound ID</th>
          <th>Patente ED</th>
          <th>Carrier</th>
          <th>Unidad</th>
          <th>Call ED</th>
          <th>Inicio IB TMS</th>
          <th>Fin IB TMS</th>
          <th>Shipments TMS</th>
          <th>Cant. Paquetes ED</th>
          <th>Diff (min)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.patenteTMS}</td>
            <td>{r.inboundId}</td>
            <td>{r.patenteED}</td>
            <td>{r.carrier}</td>
            <td>{r.unidad}</td>
            <td>{r.callED}</td>
            <td>{r.inicioIBTMS}</td>
            <td>{r.finIBTMS}</td>
            <td>{r.totalShipments}</td>
            <td>{r.cantPaquetesED}</td>
            <td>{r.diffMinutos}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
