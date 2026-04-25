export const PATENTE_VIEJA = /^[a-z]{3}[\s-]?\d{3}$/i;
export const PATENTE_NUEVA = /^[a-z]{2}[\s-]?\d{3}[\s-]?[a-z]{2}$/i;
export const PATENTES_FICTICIAS = new Set(['aaa123', 'aaa111', 'can111']);
export const SPLIT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 horas
export const TIME_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas
