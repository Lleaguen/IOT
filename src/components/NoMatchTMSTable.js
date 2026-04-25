import React from 'react';

export default function NoMatchTMSTable({ rows }) {
  if (!rows?.length) return <p className="empty-msg">No hay patentes sin matchear en TMS.</p>;
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>Patente TMS</th>
          <th>Inbound ID</th>
          <th>Carrier</th>
          <th>Inicio IB TMS</th>
          <th>Fin IB TMS</th>
          <th>Total Shipments</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.patente}</td>
            <td>{r.inboundId}</td>
            <td>{r.carrier}</td>
            <td>{r.inicioIBTMS}</td>
            <td>{r.finIBTMS}</td>
            <td>{r.shipments}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
