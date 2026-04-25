import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

export default function App() {
    const [tmsData, setTmsData] = useState([]);
    const [easyDockingData, setEasyDockingData] = useState([]);
    const [matchedData, setMatchedData] = useState([]);
    const [unmatchedTMS, setUnmatchedTMS] = useState([]);
    const [unmatchedED, setUnmatchedED] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("matched");

    // Función para leer archivo CSV (TMS)
    const handleCSVUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log("Cargando archivo CSV:", file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            
            // Parser CSV mejorado que maneja campos con comas y punto y coma
            const parseCSVLine = (line) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(current);
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current);
                return result;
            };
            
            const lines = text.split("\n").filter(line => line.trim());
            const headers = parseCSVLine(lines[0]);
            
            const data = lines.slice(1).map(line => {
                const values = parseCSVLine(line);
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header.trim()] = values[index]?.trim().replace(/^"|"$/g, ''); // Remover comillas
                });
                return obj;
            }).filter(row => row["Truck ID"]);

            console.log("Datos TMS cargados:", data.length, "registros");
            console.log("Columnas TMS:", Object.keys(data[0]));
            console.log("Muestra TMS:", data.slice(0, 3));
            
            // Verificar si hay semis
            const semis = data.filter(row => row["Truck ID"]?.includes(";"));
            if (semis.length > 0) {
                console.log(`🚛 Detectados ${semis.length} registros con formato de semi`);
                console.log("Ejemplos:", semis.slice(0, 3).map(s => s["Truck ID"]));
            }
            
            setTmsData(data);
        };
        reader.readAsText(file);
    };

    // Función para leer archivo XLSX (EasyDocking)
    const handleXLSXUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log("Cargando archivo XLSX:", file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const headers = jsonData[3];
            const rows = jsonData.slice(4).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index];
                });
                return obj;
            }).filter(row => 
                row["PATENTE"] && 
                row["PATENTE"] !== "" && 
                row["TIPO DE OPERACION"] === "Descarga"
            );

            console.log("Datos EasyDocking cargados:", rows.length, "registros");
            console.log("Columnas ED:", Object.keys(rows[0]));
            console.log("Muestra ED:", rows.slice(0, 3));
            setEasyDockingData(rows);
        };
        reader.readAsArrayBuffer(file);
    };

    // Función para parsear fecha en zona horaria de Buenos Aires (UTC-3)
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        
        try {
            // Si es número (serial de Excel), usar la función de XLSX
            if (typeof dateStr === 'number') {
                // XLSX.SSF.parse_date_code convierte el serial de Excel a fecha
                const excelDate = XLSX.SSF.parse_date_code(dateStr);
                
                // Crear fecha en zona horaria local (Buenos Aires)
                // Excel guarda las fechas sin zona horaria, asumimos que son de Buenos Aires
                const date = new Date(excelDate.y, excelDate.m - 1, excelDate.d, excelDate.H, excelDate.M, excelDate.S);
                
                return date;
            }
            
            // Si es string formato: "DD/MM/YYYY HH:MM:SS"
            if (typeof dateStr === 'string') {
                const parts = dateStr.split(' ');
                if (parts.length === 2) {
                    const [datePart, timePart] = parts;
                    const dateParts = datePart.split('/');
                    const timeParts = timePart.split(':');
                    
                    if (dateParts.length === 3 && timeParts.length === 3) {
                        const [day, month, year] = dateParts;
                        const [hours, minutes, seconds] = timeParts;
                        // Crear fecha en zona horaria local
                        return new Date(year, month - 1, day, hours, minutes, seconds);
                    }
                }
                
                // Intentar parseo estándar
                return new Date(dateStr);
            }
            
            return null;
        } catch (error) {
            console.error("Error parseando fecha:", dateStr, error);
            return null;
        }
    };

    const formatDateTime = (date) => {
        if (!date) return "N/A";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    // Levenshtein distance
    const levenshteinDistance = (str1, str2) => {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        const matrix = [];

        for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[s2.length][s1.length];
    };

    const calculateSimilarity = (str1, str2) => {
        const distance = levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return ((maxLength - distance) / maxLength) * 100;
    };

    // Función principal de matching
    const performMatching = async () => {
        setLoading(true);
        console.log("\n=== INICIANDO MATCHING ===");
        console.log("TMS registros:", tmsData.length);
        console.log("EasyDocking registros:", easyDockingData.length);

        await new Promise(resolve => setTimeout(resolve, 100));

        // Función para validar si una patente es válida (no ficticia)
        const isValidPatente = (patente) => {
            if (!patente || typeof patente !== 'string') return false;
            
            const patenteClean = patente.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
            
            // Lista negra de patentes ficticias
            const blacklist = [
                'can111', 'aaa123', 'car111', 'aaa111', 
                'test', 'prueba', 'xxx', 'zzz', 'aaa', 'bbb',
                'abc123', 'test123', 'prueba123', 'xxx111', 'zzz999',
                'aaa000', 'aaa999', 'zzz000', 'zzz111'
            ];
            
            if (blacklist.includes(patenteClean)) {
                return false;
            }
            
            // Validar patrones argentinos:
            // Formato viejo: 3 letras + 3 números (ej: ABC123)
            const formatoViejo = /^[a-z]{3}[0-9]{3}$/i;
            // Formato Mercosur: 2 letras + 3 números + 2 letras (ej: AB123CD)
            const formatoMercosur = /^[a-z]{2}[0-9]{3}[a-z]{2}$/i;
            
            return formatoViejo.test(patenteClean) || formatoMercosur.test(patenteClean);
        };

        // Crear índices de EasyDocking por patente (solo patentes válidas)
        const patentesED = new Map();
        easyDockingData.forEach(ed => {
            const patente = ed["PATENTE"];
            if (!patente || !isValidPatente(patente)) return;
            
            if (!patentesED.has(patente)) {
                patentesED.set(patente, []);
            }
            patentesED.get(patente).push(ed);
        });
        
        console.log(`Patentes ED válidas: ${patentesED.size} (filtradas de ${easyDockingData.length} registros)`);

        // Agrupar TMS por Inbound ID (o Truck ID + fecha si no existe Inbound ID)
        console.log("Agrupando TMS por descarga...");
        const descargasMap = new Map();
        
        tmsData.forEach(record => {
            const truckId = record["Truck ID"];
            const inboundId = record["Inbound ID"] || record["Inbound Id"] || null;
            const shipmentId = record["Shipment ID"];
            
            if (!truckId) return;
            
            // Validar que el Truck ID sea una patente válida (no ficticia)
            // Para semis, validar cada parte por separado
            const truckIdParts = truckId.includes(";") 
                ? truckId.split(";").map(p => p.trim())
                : [truckId];
            
            const hasValidPart = truckIdParts.some(part => isValidPatente(part));
            if (!hasValidPart) {
                console.log(`⚠️ Truck ID inválido o ficticio ignorado: ${truckId}`);
                return;
            }
            
            // Usar Inbound ID si existe, sino crear clave con Truck ID + fecha
            let descargaKey;
            if (inboundId) {
                descargaKey = inboundId;
            } else {
                const openedDate = parseDate(record["Inbound Date Opened"]);
                descargaKey = `${truckId}_${openedDate?.getTime() || ""}`;
            }
            
            if (!descargasMap.has(descargaKey)) {
                descargasMap.set(descargaKey, {
                    inboundId: inboundId || descargaKey,
                    truckId: truckId,
                    shipments: [],
                    firstOpened: record["Inbound Date Opened"],
                    lastClosed: record["Inbound Date Closed"]
                });
            }
            
            const descarga = descargasMap.get(descargaKey);
            descarga.shipments.push(record);
            
            // Actualizar fechas
            const opened = parseDate(record["Inbound Date Opened"]);
            const closed = parseDate(record["Inbound Date Closed"]);
            const currentOpened = parseDate(descarga.firstOpened);
            const currentClosed = parseDate(descarga.lastClosed);
            
            if (opened && currentOpened && opened < currentOpened) {
                descarga.firstOpened = record["Inbound Date Opened"];
            }
            if (closed && currentClosed && closed > currentClosed) {
                descarga.lastClosed = record["Inbound Date Closed"];
            }
        });

        const descargas = Array.from(descargasMap.values());
        console.log("Total descargas únicas:", descargas.length);
        console.log("Muestra descarga:", descargas[0]);

        // Crear índice para búsqueda rápida
        const indexExacto = new Map();
        const indexAnagrama = new Map();
        
        for (const [patente, registros] of patentesED.entries()) {
            const patenteLower = patente.toLowerCase().trim();
            indexExacto.set(patenteLower, { patente, registros });
            
            const anagrama = patenteLower.replace(/[^a-z0-9]/g, "").split("").sort().join("");
            if (!indexAnagrama.has(anagrama)) {
                indexAnagrama.set(anagrama, []);
            }
            indexAnagrama.get(anagrama).push({ patente, registros });
        }

        // Procesar cada DESCARGA (no cada shipment individual)
        const matched = [];
        const unmatched = [];
        const matchedPatentesED = new Set();
        const matchedTruckIDs = new Set(); // Nuevo: controlar Truck IDs ya matcheados

        for (let i = 0; i < descargas.length; i++) {
            const descarga = descargas[i];
            const truckId = descarga.truckId;
            if (!truckId) continue;
            
            // Verificar si este Truck ID ya fue matcheado
            if (matchedTruckIDs.has(truckId.toLowerCase().trim())) {
                console.log(`⚠️ Truck ID ${truckId} ya fue matcheado anteriormente, saltando...`);
                continue;
            }

            // Manejar formato de semi: "NFX904; msi982" -> ["NFX904", "msi982"]
            const truckIdParts = truckId.includes(";") 
                ? truckId.split(";").map(p => p.trim().toLowerCase())
                : [truckId.toLowerCase().trim()];
            
            if (truckId.includes(";")) {
                console.log(`🚛 Semi detectado: ${truckId} -> Partes: [${truckIdParts.join(", ")}]`);
            }
            
            const truckIdLower = truckId.toLowerCase().trim();
            const openedDate = parseDate(descarga.firstOpened);
            const closedDate = parseDate(descarga.lastClosed);

            if (i % 100 === 0) {
                console.log(`Procesando ${i}/${descargas.length}...`);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            let bestMatch = null;
            let bestSimilarity = 0;
            let bestType = "";
            let bestAdd = null;
            let bestCall = null;

            // 1. Búsqueda exacta
            for (const truckIdPart of truckIdParts) {
                const exacto = indexExacto.get(truckIdPart);
                if (exacto) {
                    const { patente, registros } = exacto;
                    
                    // Verificar si esta patente ya fue matcheada
                    if (matchedPatentesED.has(patente)) {
                        console.log(`⚠️ Patente ${patente} ya fue matcheada, saltando...`);
                        continue;
                    }
                    
                    let add = null;
                    let call = null;

                    console.log(`Match exacto encontrado para ${truckId} (parte: ${truckIdPart}) -> ${patente}`);
                    console.log(`Fecha apertura TMS: ${openedDate}`);

                    for (const reg of registros) {
                        const accion = reg["Accion"]?.toLowerCase();
                        const fechaReg = parseDate(reg["Fecha y hora"]);
                        
                        console.log(`  Registro ED: accion=${accion}, fecha=${fechaReg}, fechaStr=${reg["Fecha y hora"]}`);
                        
                        if (!fechaReg || !openedDate) {
                            console.log(`  Saltando: fechaReg=${fechaReg}, openedDate=${openedDate}`);
                            continue;
                        }
                        
                        const fechaRegStr = fechaReg.toDateString();
                        const openedDateStr = openedDate.toDateString();
                        console.log(`  Comparando fechas: ${fechaRegStr} vs ${openedDateStr}`);
                        
                        if (fechaRegStr !== openedDateStr) {
                            console.log(`  Fechas diferentes, saltando`);
                            continue;
                        }

                        if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                            console.log(`  ✓ Add encontrado: ${fechaReg}`);
                            add = reg;
                        }
                        if (accion === "call" && (!call || fechaReg > parseDate(call["Fecha y hora"]))) {
                            console.log(`  ✓ Call encontrado: ${fechaReg}`);
                            call = reg;
                        }
                    }

                    if (add) {
                        console.log(`✓ Match válido con add`);
                        bestMatch = registros[0];
                        bestSimilarity = 100;
                        bestType = "exact";
                        bestAdd = add;
                        bestCall = call;
                        break;
                    } else {
                        console.log(`✗ No se encontró add del mismo día`);
                    }
                }
                if (bestMatch) break;
            }

            // 2. Búsqueda por anagrama
            if (!bestMatch) {
                for (const truckIdPart of truckIdParts) {
                    const truckAnagrama = truckIdPart.replace(/[^a-z0-9]/g, "").split("").sort().join("");
                    const candidatos = indexAnagrama.get(truckAnagrama);
                    
                    if (candidatos && candidatos.length > 0) {
                        for (const { patente, registros } of candidatos) {
                            // Verificar si esta patente ya fue matcheada
                            if (matchedPatentesED.has(patente)) {
                                continue;
                            }
                            
                            let add = null;
                            let call = null;

                            for (const reg of registros) {
                                const accion = reg["Accion"]?.toLowerCase();
                                const fechaReg = parseDate(reg["Fecha y hora"]);
                                
                                if (!fechaReg || !openedDate) continue;
                                if (fechaReg.toDateString() !== openedDate.toDateString()) continue;

                                if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                                    add = reg;
                                }
                                if (accion === "call" && (!call || fechaReg > parseDate(call["Fecha y hora"]))) {
                                    call = reg;
                                }
                            }

                            if (add) {
                                bestMatch = registros[0];
                                bestSimilarity = 95;
                                bestType = "anagram";
                                bestAdd = add;
                                bestCall = call;
                                break;
                            }
                        }
                    }
                    if (bestMatch) break;
                }
            }

            // 3. Búsqueda por proximidad (solo si no hay match exacto o anagrama)
            if (!bestMatch) {
                let maxComparisons = 500;
                let comparisons = 0;
                
                for (const [patente, registros] of patentesED.entries()) {
                    if (comparisons++ > maxComparisons) break;
                    
                    // Verificar si esta patente ya fue matcheada
                    if (matchedPatentesED.has(patente)) {
                        continue;
                    }
                    
                    const patenteLower = patente.toLowerCase().trim();
                    
                    // Intentar con cada parte del Truck ID
                    for (const truckIdPart of truckIdParts) {
                        const similarity = calculateSimilarity(truckIdPart, patenteLower);
                        
                        if (similarity >= 60 && similarity > bestSimilarity) {
                            let add = null;
                            let call = null;

                            for (const reg of registros) {
                                const accion = reg["Accion"]?.toLowerCase();
                                const fechaReg = parseDate(reg["Fecha y hora"]);
                                
                                if (!fechaReg || !openedDate) continue;
                                if (fechaReg.toDateString() !== openedDate.toDateString()) continue;

                                if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                                    add = reg;
                                }
                                if (accion === "call" && (!call || fechaReg > parseDate(call["Fecha y hora"]))) {
                                    call = reg;
                                }
                            }

                            if (add) {
                                bestMatch = registros[0];
                                bestSimilarity = similarity;
                                bestType = "proximity";
                                bestAdd = add;
                                bestCall = call;
                            }
                        }
                    }
                }
            }

            // 4. Búsqueda por cantidad de paquetes similar (±10%)
            if (!bestMatch) {
                const totalPaquetesTMS = descarga.shipments.reduce((sum, s) => {
                    const paquetes = parseInt(s["Pieces"] || s["CANT PAQUETES"] || 0);
                    return sum + paquetes;
                }, 0);
                
                if (totalPaquetesTMS > 0) {
                    console.log(`Intentando match por cantidad de paquetes para ${truckId}: ${totalPaquetesTMS} paquetes...`);
                    
                    for (const [patente, registros] of patentesED.entries()) {
                        // Verificar si esta patente ya fue matcheada
                        if (matchedPatentesED.has(patente)) {
                            continue;
                        }
                        
                        // Buscar el registro con la cantidad de paquetes más cercana
                        let bestPaquetesMatch = null;
                        let bestPaquetesDiff = Infinity;
                        
                        for (const reg of registros) {
                            const paquetesED = reg["CANT PAQUETES"] || reg["Cant Paquetes"];
                            
                            if (paquetesED) {
                                const diff = Math.abs(paquetesED - totalPaquetesTMS);
                                const diffPercent = (diff / totalPaquetesTMS) * 100;
                                
                                if (diffPercent <= 20 && diff < bestPaquetesDiff) {
                                    bestPaquetesDiff = diff;
                                    bestPaquetesMatch = reg;
                                }
                            }
                        }
                        
                        if (bestPaquetesMatch) {
                            let add = null;
                            let call = null;

                            for (const reg of registros) {
                                const accion = reg["Accion"]?.toLowerCase();
                                const fechaReg = parseDate(reg["Fecha y hora"]);
                                
                                if (!fechaReg || !openedDate) continue;
                                if (fechaReg.toDateString() !== openedDate.toDateString()) continue;

                                if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                                    add = reg;
                                }
                                if (accion === "call" && (!call || fechaReg > parseDate(call["Fecha y hora"]))) {
                                    call = reg;
                                }
                            }

                            if (add) {
                                const paquetesED = bestPaquetesMatch["CANT PAQUETES"] || bestPaquetesMatch["Cant Paquetes"];
                                console.log(`✓ Match por cantidad de paquetes: ${truckId} -> ${patente} (${paquetesED} paquetes, diff: ${bestPaquetesDiff})`);
                                bestMatch = bestPaquetesMatch;
                                bestSimilarity = 75;
                                bestType = "packages";
                                bestAdd = add;
                                bestCall = call;
                                break;
                            }
                        }
                    }
                }
            }

            // 5. Búsqueda por carrier/transporte (si existe en los datos)
            if (!bestMatch) {
                const carrier = descarga.shipments[0]["Carrier"] || descarga.shipments[0]["CARRIER"];
                
                if (carrier) {
                    console.log(`Intentando match por carrier para ${truckId}: ${carrier}...`);
                    
                    for (const [patente, registros] of patentesED.entries()) {
                        // Verificar si esta patente ya fue matcheada
                        if (matchedPatentesED.has(patente)) {
                            continue;
                        }
                        
                        const transporte = registros[0]["TRANSPORTE"] || registros[0]["Transporte"];
                        
                        if (transporte && transporte.toLowerCase().includes(carrier.toLowerCase())) {
                            let add = null;
                            let call = null;

                            for (const reg of registros) {
                                const accion = reg["Accion"]?.toLowerCase();
                                const fechaReg = parseDate(reg["Fecha y hora"]);
                                
                                if (!fechaReg || !openedDate) continue;
                                if (fechaReg.toDateString() !== openedDate.toDateString()) continue;

                                if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                                    add = reg;
                                }
                                if (accion === "call" && (!call || fechaReg > parseDate(call["Fecha y hora"]))) {
                                    call = reg;
                                }
                            }

                            if (add) {
                                console.log(`✓ Match por carrier: ${truckId} -> ${patente}`);
                                bestMatch = registros[0];
                                bestSimilarity = 80;
                                bestType = "carrier";
                                bestAdd = add;
                                bestCall = call;
                                break;
                            }
                        }
                    }
                }
            }

            // 6. Búsqueda por proximidad horaria (call dentro de 10 minutos del inicio IB)
            if (!bestMatch && openedDate) {
                console.log(`Intentando match por proximidad horaria para ${truckId}...`);
                
                for (const [patente, registros] of patentesED.entries()) {
                    // Verificar si esta patente ya fue matcheada
                    if (matchedPatentesED.has(patente)) {
                        continue;
                    }
                    
                    let call = null;
                    let add = null;

                    for (const reg of registros) {
                        const accion = reg["Accion"]?.toLowerCase();
                        const fechaReg = parseDate(reg["Fecha y hora"]);
                        
                        if (!fechaReg || !openedDate) continue;
                        if (fechaReg.toDateString() !== openedDate.toDateString()) continue;

                        if (accion === "call") {
                            // Calcular diferencia en minutos entre call e inicio IB
                            const diffMinutes = Math.abs((fechaReg - openedDate) / 1000 / 60);
                            
                            if (diffMinutes <= 30) {
                                if (!call || Math.abs((fechaReg - openedDate) / 1000 / 60) < Math.abs((parseDate(call["Fecha y hora"]) - openedDate) / 1000 / 60)) {
                                    call = reg;
                                }
                            }
                        }
                        
                        if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                            add = reg;
                        }
                    }

                    if (call && add) {
                        console.log(`✓ Match por proximidad horaria: ${truckId} -> ${patente}`);
                        bestMatch = registros[0];
                        bestSimilarity = 85;
                        bestType = "time-proximity";
                        bestAdd = add;
                        bestCall = call;
                        break;
                    }
                }
            }

            // 7. Búsqueda por coincidencia parcial de números (CUIT, DNI, etc.)
            if (!bestMatch) {
                // Extraer números del Truck ID
                const truckNumbers = truckId.replace(/[^0-9]/g, "");
                
                if (truckNumbers.length >= 8) {
                    console.log(`Intentando match por números para ${truckId} (números: ${truckNumbers})...`);
                    
                    for (const [patente, registros] of patentesED.entries()) {
                        // Verificar si esta patente ya fue matcheada
                        if (matchedPatentesED.has(patente)) {
                            continue;
                        }
                        
                        const patenteNumbers = patente.replace(/[^0-9]/g, "");
                        
                        // Comparar si los números coinciden (exacto o contiene)
                        if (patenteNumbers.length >= 8 && 
                            (truckNumbers === patenteNumbers || 
                             truckNumbers.includes(patenteNumbers) || 
                             patenteNumbers.includes(truckNumbers))) {
                            
                            let add = null;
                            let call = null;

                            for (const reg of registros) {
                                const accion = reg["Accion"]?.toLowerCase();
                                const fechaReg = parseDate(reg["Fecha y hora"]);
                                
                                if (!fechaReg || !openedDate) continue;
                                if (fechaReg.toDateString() !== openedDate.toDateString()) continue;

                                if (accion === "add" && (!add || fechaReg < parseDate(add["Fecha y hora"]))) {
                                    add = reg;
                                }
                                if (accion === "call" && (!call || fechaReg > parseDate(call["Fecha y hora"]))) {
                                    call = reg;
                                }
                            }

                            if (add) {
                                console.log(`✓ Match por números: ${truckId} -> ${patente}`);
                                bestMatch = registros[0];
                                bestSimilarity = 70;
                                bestType = "numeric";
                                bestAdd = add;
                                bestCall = call;
                                break;
                            }
                        }
                    }
                }
            }

            if (bestMatch) {
                console.log(`🔍 Verificando match: TMS ${truckId} -> ED ${bestMatch["PATENTE"]}`);
                
                // Marcar la patente ED como matcheada PRIMERO
                matchedPatentesED.add(bestMatch["PATENTE"]);
                console.log(`✓ Patente ${bestMatch["PATENTE"]} marcada como matcheada. Total ED matcheadas: ${matchedPatentesED.size}`);
                
                // Verificar nuevamente si este Truck ID ya fue matcheado (doble verificación)
                if (matchedTruckIDs.has(truckId.toLowerCase().trim())) {
                    console.log(`⚠️ Truck ID ${truckId} ya fue matcheado, no se agregará de nuevo`);
                    continue;
                }
                
                matchedTruckIDs.add(truckId.toLowerCase().trim()); // Marcar Truck ID como matcheado
                
                console.log(`✅ Match confirmado: TMS ${truckId} -> ED ${bestMatch["PATENTE"]} (tipo: ${bestType})`);

                matched.push({
                    patente: bestMatch["PATENTE"],
                    truckId: truckId,
                    inboundId: descarga.inboundId,
                    shipmentCount: descarga.shipments.length,
                    fecha: openedDate ? openedDate.toLocaleDateString() : "N/A",
                    tipoVehiculo: bestMatch["TIPO DE VEHICULO"] || "N/A",
                    arribo: bestAdd ? formatDateTime(parseDate(bestAdd["Fecha y hora"])) : "N/A",
                    call: bestCall ? formatDateTime(parseDate(bestCall["Fecha y hora"])) : "N/A",
                    inicioIB: formatDateTime(openedDate),
                    finIB: formatDateTime(closedDate),
                    matchType: bestType,
                    similarity: bestSimilarity.toFixed(2)
                });
            } else {
                unmatched.push(descarga);
            }
        }

        // Patentes ED no matcheadas - mostrar cada combinación única de patente + cantidad de paquetes
        const unmatchedEDPatentes = [];
        for (const [patente, registros] of patentesED.entries()) {
            if (!matchedPatentesED.has(patente)) {
                // Agrupar por cantidad de paquetes
                const paquetesMap = new Map();
                
                for (const reg of registros) {
                    const paquetes = reg["CANT PAQUETES"] || reg["Cant Paquetes"] || "N/A";
                    const key = `${paquetes}`;
                    
                    if (!paquetesMap.has(key)) {
                        paquetesMap.set(key, {
                            patente,
                            tipoVehiculo: reg["TIPO DE VEHICULO"] || "N/A",
                            cantPaquetes: paquetes,
                            registros: 0
                        });
                    }
                    paquetesMap.get(key).registros++;
                }
                
                // Agregar cada combinación única
                for (const entry of paquetesMap.values()) {
                    unmatchedEDPatentes.push(entry);
                }
            }
        }

        console.log("\n=== RESULTADOS ===");
        console.log("Matcheadas:", matched.length);
        console.log("TMS no matcheadas:", unmatched.length);
        console.log("ED no matcheadas:", unmatchedEDPatentes.length);
        
        // Diagnóstico detallado
        console.log("\n=== DIAGNÓSTICO ===");
        console.log("Total descargas TMS:", descargas.length);
        console.log("Total patentes ED únicas:", patentesED.size);
        console.log("Patentes ED matcheadas:", matchedPatentesED.size);
        console.log("Patentes ED sin matchear:", patentesED.size - matchedPatentesED.size);
        
        // Detectar duplicados en matches
        const truckIdsMatcheados = matched.map(m => m.truckId);
        const truckIdsDuplicados = truckIdsMatcheados.filter((id, index) => truckIdsMatcheados.indexOf(id) !== index);
        if (truckIdsDuplicados.length > 0) {
            console.warn("⚠️ TRUCK IDs DUPLICADOS EN MATCHES:", [...new Set(truckIdsDuplicados)]);
        }
        
        const patentesEDMatcheadas = matched.map(m => m.patente);
        const patentesEDDuplicadas = patentesEDMatcheadas.filter((p, index) => patentesEDMatcheadas.indexOf(p) !== index);
        if (patentesEDDuplicadas.length > 0) {
            console.warn("⚠️ PATENTES ED DUPLICADAS EN MATCHES:", [...new Set(patentesEDDuplicadas)]);
        }
        
        // Mostrar ejemplos de TMS no matcheadas
        if (unmatched.length > 0) {
            console.log("\n📋 Ejemplos de TMS no matcheadas:");
            unmatched.slice(0, 5).forEach(desc => {
                console.log(`  - Truck ID: ${desc.truckId}, Fecha: ${desc.firstOpened}`);
            });
        }

        setMatchedData(matched);
        setUnmatchedTMS(unmatched);
        setUnmatchedED(unmatchedEDPatentes);
        setLoading(false);
    };

    // Exportar a Excel
    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(matchedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Matched Data");
        XLSX.writeFile(workbook, "matched_trucks.xlsx");
    };

    return (
        <div className="app-container">
            <h1>Sistema de Matching TMS - EasyDocking</h1>
            
            <div className="upload-section">
                <div className="upload-box">
                    <label>
                        <strong>Subir archivo CSV (TMS):</strong>
                        <input type="file" accept=".csv" onChange={handleCSVUpload} />
                    </label>
                    {tmsData.length > 0 && <p>✓ {tmsData.length} registros cargados</p>}
                </div>

                <div className="upload-box">
                    <label>
                        <strong>Subir archivo XLSX (EasyDocking):</strong>
                        <input type="file" accept=".xlsx" onChange={handleXLSXUpload} />
                    </label>
                    {easyDockingData.length > 0 && <p>✓ {easyDockingData.length} registros cargados</p>}
                </div>
            </div>

            <button 
                className="match-button"
                onClick={performMatching}
                disabled={tmsData.length === 0 || easyDockingData.length === 0 || loading}
            >
                {loading ? "Procesando..." : "Realizar Matching"}
            </button>

            <div style={{ textAlign: 'center', marginTop: '10px', color: '#666', fontSize: '0.9rem' }}>
                TMS: {tmsData.length} registros | EasyDocking: {easyDockingData.length} registros
            </div>

            {matchedData.length > 0 && (
                <>
                    <button className="export-button" onClick={exportToExcel}>
                        Exportar a Excel
                    </button>

                    {/* Pestañas */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderBottom: '2px solid #ddd' }}>
                        <button 
                            onClick={() => setActiveTab("matched")}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderBottom: activeTab === "matched" ? '3px solid #007bff' : '3px solid transparent',
                                background: activeTab === "matched" ? '#f8f9fa' : 'transparent',
                                cursor: 'pointer',
                                fontWeight: activeTab === "matched" ? 'bold' : 'normal',
                                color: activeTab === "matched" ? '#007bff' : '#666'
                            }}
                        >
                            Matcheadas ({matchedData.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab("unmatchedTMS")}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderBottom: activeTab === "unmatchedTMS" ? '3px solid #dc3545' : '3px solid transparent',
                                background: activeTab === "unmatchedTMS" ? '#f8f9fa' : 'transparent',
                                cursor: 'pointer',
                                fontWeight: activeTab === "unmatchedTMS" ? 'bold' : 'normal',
                                color: activeTab === "unmatchedTMS" ? '#dc3545' : '#666'
                            }}
                        >
                            TMS No Matcheadas ({unmatchedTMS.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab("unmatchedED")}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderBottom: activeTab === "unmatchedED" ? '3px solid #ffc107' : '3px solid transparent',
                                background: activeTab === "unmatchedED" ? '#f8f9fa' : 'transparent',
                                cursor: 'pointer',
                                fontWeight: activeTab === "unmatchedED" ? 'bold' : 'normal',
                                color: activeTab === "unmatchedED" ? '#ffc107' : '#666'
                            }}
                        >
                            EasyDocking No Matcheadas ({unmatchedED.length})
                        </button>
                    </div>

                    {/* Tabla Matcheadas */}
                    {activeTab === "matched" && (
                        <div className="results-section">
                            <h2>Resultados del Matching ({matchedData.length} registros)</h2>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Patente</th>
                                            <th>Truck ID</th>
                                            <th>Inbound ID</th>
                                            <th>Shipments</th>
                                            <th>Fecha</th>
                                            <th>Tipo Vehículo</th>
                                            <th>Arribo</th>
                                            <th>Call</th>
                                            <th>Inicio IB</th>
                                            <th>Fin IB</th>
                                            <th>Match</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matchedData.map((row, index) => (
                                            <tr 
                                                key={index}
                                                className={row.matchType !== "exact" ? "fuzzy-match" : ""}
                                            >
                                                <td>{row.patente}</td>
                                                <td>{row.truckId}</td>
                                                <td>{row.inboundId}</td>
                                                <td>{row.shipmentCount}</td>
                                                <td>{row.fecha}</td>
                                                <td>{row.tipoVehiculo}</td>
                                                <td>{row.arribo}</td>
                                                <td>{row.call}</td>
                                                <td>{row.inicioIB}</td>
                                                <td>{row.finIB}</td>
                                                <td>
                                                    <span className={`match-badge ${row.matchType}`}>
                                                        {row.matchType === "exact" ? "✓" : `~${row.similarity}%`}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tabla TMS No Matcheadas */}
                    {activeTab === "unmatchedTMS" && (
                        <div className="results-section">
                            <h2>TMS No Matcheadas ({unmatchedTMS.length} registros)</h2>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Truck ID</th>
                                            <th>Inbound ID</th>
                                            <th>Shipments</th>
                                            <th>Fecha Apertura</th>
                                            <th>Fecha Cierre</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unmatchedTMS.map((row, index) => (
                                            <tr key={index}>
                                                <td>{row.truckId}</td>
                                                <td>{row.inboundId}</td>
                                                <td>{row.shipments.length}</td>
                                                <td>{row.firstOpened}</td>
                                                <td>{row.lastClosed}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tabla ED No Matcheadas */}
                    {activeTab === "unmatchedED" && (
                        <div className="results-section">
                            <h2>EasyDocking No Matcheadas ({unmatchedED.length} registros)</h2>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Patente</th>
                                            <th>Tipo Vehículo</th>
                                            <th>Cant Paquetes</th>
                                            <th>Cantidad Registros</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unmatchedED.map((row, index) => (
                                            <tr key={index}>
                                                <td>{row.patente}</td>
                                                <td>{row.tipoVehiculo}</td>
                                                <td>{row.cantPaquetes}</td>
                                                <td>{row.registros}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
