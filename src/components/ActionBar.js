import React from 'react';

export default function ActionBar({ canProcess, processing, onProcess, onExport, canExport }) {
  return (
    <div className="actions">
      <button className="btn-primary" onClick={onProcess} disabled={!canProcess || processing}>
        {processing ? 'Procesando...' : 'Procesar'}
      </button>
      <button className="btn-export" onClick={onExport} disabled={!canExport}>
        Exportar a Excel
      </button>
    </div>
  );
}
