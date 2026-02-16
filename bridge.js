const { NFC } = require('nfc-pcsc');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// ==========================================
// CONFIGURACIÓN
// ==========================================
const ALIAS_FILE = path.join(__dirname, 'aliases.json');

// Configuración del Puerto Serie (Escáner)
// Pon null para autodetectar, o el puerto fijo ej: "COM3"
const FIXED_SERIAL_PORT = null; 
const BAUD_RATE = 9600;

// Inicialización de servidores
const nfc = new NFC();
const wss = new WebSocket.Server({ port: 3000 });
let serialPortInstance = null;

// Base de datos en memoria
let aliases = {};

console.log("--- PUENTE UNIFICADO (RFID + CÓDIGO DE BARRAS) ---");

// ==========================================
// 1. GESTIÓN DE BASE DE DATOS (aliases.json)
// ==========================================
function loadAliases() {
    if (!fs.existsSync(ALIAS_FILE)) {
        fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2));
    }
    try {
        const data = fs.readFileSync(ALIAS_FILE);
        aliases = JSON.parse(data);
        console.log(`[DB] aliases.json cargado: ${Object.keys(aliases).length} registros.`);
    } catch (err) {
        console.error("[DB] Error leyendo JSON:", err);
        aliases = {};
    }
}

function saveAlias(id, name, clientWs) {
    aliases[id] = name; // Sirve tanto para UID como para Código de Barras
    persistAliases(clientWs);
}

function saveBatch(ids, name, clientWs) {
    ids.forEach(id => { aliases[id] = name; });
    persistAliases(clientWs);
}

function deleteBatch(ids) {
    let changed = false;
    ids.forEach(id => {
        if (aliases[id]) { delete aliases[id]; changed = true; }
    });
    if (changed) persistAliases();
}

function deleteAlias(id) {
    if (aliases[id]) {
        delete aliases[id];
        persistAliases();
    }
}

function persistAliases(clientWs = null) {
    try {
        fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2));
        broadcast({ type: 'aliases-update', data: aliases });
        
        if (clientWs) clientWs.send(JSON.stringify({ type: 'save-success' }));
        console.log("[DB] Guardado exitoso.");
    } catch (err) {
        console.error("[DB] Error guardando:", err.message);
        if (clientWs) clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
    }
}

// ==========================================
// 2. PUERTO SERIE (CÓDIGO DE BARRAS)
// ==========================================
async function initSerialPort() {
    let portPath = FIXED_SERIAL_PORT;

    // Autodetección
    if (!portPath) {
        try {
            const ports = await SerialPort.list();
            // Buscar dispositivos que parezcan escáneres o seriales genéricos
            const candidate = ports.find(p => 
                (p.manufacturer && (p.manufacturer.includes('Arduino') || p.manufacturer.includes('Prolific') || p.manufacturer.includes('CH340'))) ||
                (p.pnpId && p.pnpId.includes('USB'))
            );
            if (candidate) portPath = candidate.path;
            else if (ports.length > 0) portPath = ports[ports.length - 1].path;
        } catch (e) { /* ignorar */ }
    }

    if (!portPath) {
        console.log("[Serial] Buscando escáner...");
        setTimeout(initSerialPort, 3000); // Reintentar cada 3s
        return;
    }

    try {
        serialPortInstance = new SerialPort({ path: portPath, baudRate: BAUD_RATE });
        // Usamos ReadlineParser porque los escáneres suelen enviar un "Enter" (\r) al final
        const parser = serialPortInstance.pipe(new ReadlineParser({ delimiter: '\r' }));

        serialPortInstance.on('open', () => console.log(`[Serial] Conectado en ${portPath}`));

        parser.on('data', (data) => {
            // Limpiamos espacios y caracteres nulos
            const barcode = data.toString().trim().replace(/\u0000/g, '');
            if (!barcode) return;

            console.log(`[Serial] Escaneado: ${barcode}`);

            // TRUCO: Enviamos el mismo evento 'card-read' que usa el RFID
            // Así el Frontend no nota la diferencia.
            broadcast({ 
                type: 'card-read', 
                uid: barcode, // Enviamos el código como si fuera el UID
                source: 'barcode',
                knownName: aliases[barcode] || null 
            });
        });

        serialPortInstance.on('close', () => {
            console.log('[Serial] Desconectado. Reintentando...');
            setTimeout(initSerialPort, 3000);
        });

        serialPortInstance.on('error', (err) => {
            console.error('[Serial] Error:', err.message);
            if (serialPortInstance.isOpen) serialPortInstance.close();
            else setTimeout(initSerialPort, 3000);
        });

    } catch (e) {
        setTimeout(initSerialPort, 3000);
    }
}

// ==========================================
// 3. LECTOR RFID (NFC)
// ==========================================
nfc.on('reader', reader => {
    console.log(`[NFC] Lector listo: ${reader.reader.name}`);

    reader.on('card', card => {
        const uid = card.uid.toUpperCase();
        console.log(`[NFC] Tarjeta: ${uid}`);

        broadcast({ 
            type: 'card-read', 
            uid: uid,
            source: 'rfid',
            knownName: aliases[uid] || null 
        });
    });

    reader.on('error', err => console.error('[NFC] Error lector:', err));
});
nfc.on('error', err => console.error('[NFC] Error servicio NFC:', err));


// ==========================================
// 4. WEBSOCKET (COMUNICACIÓN CON NAVEGADOR)
// ==========================================
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
    });
}

wss.on('connection', ws => {
    console.log('[WS] Cliente web conectado');
    // Enviar lista actual al conectar
    ws.send(JSON.stringify({ type: 'aliases-update', data: aliases }));

    ws.on('message', message => {
        try {
            const msg = JSON.parse(message.toString());
            
            if (msg.type === 'save-alias') {
                saveAlias(msg.uid, msg.name, ws);
            }
            if (msg.type === 'save-batch-alias') {
                saveBatch(msg.uids, msg.name, ws);
            }
            if (msg.type === 'delete-batch-alias') {
                deleteBatch(msg.uids);
            }
            if (msg.type === 'delete-alias') {
                deleteAlias(msg.uid);
            }
        } catch (e) {
            console.error("Error procesando mensaje WS:", e);
        }
    });
});

// ==========================================
// INICIO
// ==========================================
loadAliases();
initSerialPort();