# IOT - Sistema de Matching TMS - EasyDocking

Sistema para analizar y matchear datos de archivos CSV (TMS) y XLSX (EasyDocking) relacionados con descargas de camiones.

## Características

- ✅ Carga de archivos CSV (TMS) y XLSX (EasyDocking)
- ✅ Matching exacto de patentes
- ✅ Algoritmo de detección de anagramas (patentes con letras/números desordenados)
- ✅ Algoritmo de proximidad (Levenshtein Distance) para patentes similares
- ✅ Agrupación automática de descargas partidas (dentro de 30 minutos)
- ✅ Indicadores visuales de tipo de match y porcentaje de similitud
- ✅ Exportación de resultados a Excel
- ✅ Interfaz responsive y moderna

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

La aplicación se abrirá en `http://localhost:3000`

## Formato de Archivos

### CSV (TMS)
Debe contener las columnas:
- Shipment ID
- Truck ID
- Inbound Date Opened
- Inbound Date Closed

### XLSX (EasyDocking)
- Las primeras 3 filas se ignoran
- La fila 4 se usa como encabezados
- Debe contener:
  - Patente
  - TIPO DE VEHICULO
  - TPO DE OPERACION
  - Accion (Add/Call)
  - Fecha

## Algoritmos de Matching

1. **Match Exacto**: Coincidencia directa entre Truck ID y Patente
2. **Match por Anagrama**: Detecta patentes con letras/números desordenados
3. **Match por Proximidad**: Usa distancia de Levenshtein (umbral 70%)

## Build para Producción

```bash
npm run build
```

Los archivos se generarán en la carpeta `dist/`