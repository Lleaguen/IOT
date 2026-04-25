import React, { useRef } from 'react';

/**
 * Zona de carga de archivo con validación de extensión.
 * Props: label, accept, onFile, error, fileName
 */
export default function FileUploader({ label, accept, onFile, error, fileName }) {
  const inputRef = useRef();

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = accept.replace('.', '').split(',').map((a) => a.trim().replace('.', ''));

    if (!allowed.includes(ext)) {
      onFile(null, `Formato incorrecto. Se esperaba: ${accept}`);
      return;
    }
    onFile(file, null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = accept.replace('.', '').split(',').map((a) => a.trim().replace('.', ''));
    if (!allowed.includes(ext)) {
      onFile(null, `Formato incorrecto. Se esperaba: ${accept}`);
      return;
    }
    onFile(file, null);
  };

  return (
    <div
      className={`file-uploader ${error ? 'has-error' : ''} ${fileName ? 'has-file' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="uploader-icon">📂</div>
      <div className="uploader-label">{label}</div>
      {fileName && <div className="uploader-filename">✅ {fileName}</div>}
      {error && <div className="uploader-error">⚠️ {error}</div>}
      {!fileName && !error && (
        <div className="uploader-hint">Hacé clic o arrastrá el archivo aquí</div>
      )}
    </div>
  );
}
