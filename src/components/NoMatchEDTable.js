import React from 'react';

export default function NoMatchEDTable({ rows }) {
  if (!rows?.length) return <p className="empty-msg">No hay patentes sin matchear en ED.</p>;
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>Patente ED</th>
          <th>Tipo Vehículo</th>
          <th>Cant. Paquetes</th>
          <th>Transporte</th>
          <th>Arribo</th>
          <th>Call</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.patente}</td>
            <td>{r.unidad}</td>
            <td>{r.cantPaquetes}</td>
            <td>{r.transporte}</td>
            <td>{r.arribo}</td>
            <td>{r.call}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
