import React, { useState, useMemo } from 'react';

const MATCH_LABELS = {
  exact: { label: 'Exacto', color: '' },
  'fuzzy-high': { label: 'Posible (alto)', color: 'rgba(251,191,36,0.15)' },
  'fuzzy-low': { label: 'Posible (bajo)', color: 'rgba(248,113,113,0.15)' },
  none: { label: 'Sin coincidencia', color: '' },
};

const COLUMNS = [
  { key: 'matchType', label: 'Estado' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'patente', label: 'Patente' },
  { key: 'matchedPatente', label: 'Patente ED' },
  { key: 'unidad', label: 'Unidad' },
  { key: 'arribo', label: 'Arribo' },
  { key: 'call', label: 'Call' },
  { key: 'inicioIBTMS', label: 'Inicio IB TMS' },
  { key: 'finIBTMS', label: 'Fin IB TMS' },
  { key: 'totalShipments', label: 'Total Shipments' },
];

export default function ResultTable({ results }) {
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0 });
  const [filters, setFilters] = useState({});

  if (!results || results.length === 0) return null;

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
  };

  const filtered = useMemo(() => {
    return results.filter(row => {
      return COLUMNS.every(col => {
        const f = (filters[col.key] || '').toLowerCase().trim();
        if (!f) return true;
        const val = col.key === 'matchType'
          ? (MATCH_LABELS[row[col.key]]?.label || '').toLowerCase()
          : String(row[col.key] || '').toLowerCase();
        return val.includes(f);
      });
    });
  }, [results, filters]);

  const handleMouseEnter = (e, row) => {
    if (row.matchType === 'fuzzy-high' || row.matchType === 'fuzzy-low') {
      const pct = Math.round(row.score * 100);
      const text = `Posible coincidencia: ${row.matchedPatente}. Similitud: ${pct}%. Se recomienda verificación manual.`;
      setTooltip({ visible: true, text, x: e.clientX + 12, y: e.clientY + 12 });
    }
  };

  const handleMouseMove = (e) => {
    if (tooltip.visible) setTooltip(t => ({ ...t, x: e.clientX + 12, y: e.clientY + 12 }));
  };

  const handleMouseLeave = () => setTooltip({ visible: false, text: '', x: 0, y: 0 });

  return (
    <div className="result-table-wrapper">
      {tooltip.visible && (
        <div className="tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          {tooltip.text}
        </div>
      )}
      <table className="result-table">
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
          <tr className="filter-row">
            {COLUMNS.map(col => (
              <th key={col.key}>
                <input
                  className="col-filter"
                  placeholder="Filtrar..."
                  value={filters[col.key] || ''}
                  onChange={e => handleFilterChange(col.key, e.target.value)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => {
            const { label, color } = MATCH_LABELS[row.matchType] || MATCH_LABELS.none;
            return (
              <tr
                key={i}
                style={{ backgroundColor: color }}
                onMouseEnter={(e) => handleMouseEnter(e, row)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <td>{label}</td>
                <td>{row.carrier}</td>
                <td>{row.patente}</td>
                <td>{row.matchedPatente}</td>
                <td>{row.unidad}</td>
                <td>{row.arribo}</td>
                <td>{row.call}</td>
                <td>{row.inicioIBTMS}</td>
                <td>{row.finIBTMS}</td>
                <td>{row.totalShipments}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
