const { NFC } = require('nfc-pcsc');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const ALIAS_FILE = path.join(__dirname, 'aliases.json');
const nfc = new NFC();
const wss = new WebSocket.Server({ port: 3000 });

// --- GESTIÓN DE BASE DE DATOS JSON ---
let aliases = {};

// Cargar o crear el archivo JSON al iniciar
function loadAliases() {
    if (!fs.existsSync(ALIAS_FILE)) {
        fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2));
        console.log("Archivo aliases.json creado.");
    }
    try {
        const data = fs.readFileSync(ALIAS_FILE);
        aliases = JSON.parse(data);
    } catch (err) {
        console.error("Error leyendo JSON:", err);
        aliases = {};
    }
}

function saveAlias(uid, name, clientWs) {
    aliases[uid] = name;
    try {
        fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2));
        console.log(`Guardado: ${uid} -> ${name}`);
        broadcast({ type: 'aliases-update', data: aliases });
        if (clientWs) clientWs.send(JSON.stringify({ type: 'save-success' }));
    } catch (err) {
        console.error("ERROR: No se pudo guardar en aliases.json. ¿Está el archivo abierto?", err.message);
        if (clientWs) clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
    }
}

function saveBatch(uids, name, clientWs) {
    uids.forEach(uid => { aliases[uid] = name; });
    try {
        fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2));
        console.log(`Guardado Batch: ${uids.length} tarjetas -> ${name}`);
        broadcast({ type: 'aliases-update', data: aliases });
        if (clientWs) clientWs.send(JSON.stringify({ type: 'save-success' }));
    } catch (err) {
        console.error("ERROR Batch: No se pudo guardar.", err.message);
        if (clientWs) clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
    }
}

function deleteBatch(uids) {
    let changed = false;
    uids.forEach(uid => {
        if (aliases[uid]) {
            delete aliases[uid];
            changed = true;
        }
    });
    if (changed) {
        try {
            fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2));
            broadcast({ type: 'aliases-update', data: aliases });
        } catch (err) {
            console.error("ERROR: No se pudo borrar batch de aliases.json.", err.message);
        }
    }
}

function deleteAlias(uid) {
    if (aliases[uid]) {
        delete aliases[uid];
        try {
            fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2));
            broadcast({ type: 'aliases-update', data: aliases });
        } catch (err) {
            console.error("ERROR: No se pudo borrar de aliases.json.", err.message);
        }
    }
}

// Cargar datos iniciales
loadAliases();

console.log("--- SERVIDOR RFID CON BBDD JSON LISTO ---");

// --- WEBSOCKET ---
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
    });
}

wss.on('connection', ws => {
    console.log('Cliente Web conectado');
    // Al conectar, enviamos la lista actual de nombres
    ws.send(JSON.stringify({ type: 'aliases-update', data: aliases }));

    // Recibir órdenes del navegador (Guardar nombre)
    ws.on('message', message => {
        try {
            // Convertimos el buffer a string antes de parsear
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
            console.error("Error procesando mensaje del cliente:", e);
        }
    });
});

// --- LECTOR RFID ---
nfc.on('reader', reader => {
    console.log(`Lector listo: ${reader.reader.name}`);
    
    reader.on('card', card => {
        // Normalizamos el UID a mayúsculas
        const uid = card.uid.toUpperCase(); 
        console.log(`Leído: ${uid}`);
        
        // Enviamos al navegador el UID y si ya tiene nombre
        broadcast({ 
            type: 'card-read', 
            uid: uid,
            knownName: aliases[uid] || null 
        });
    });

    reader.on('error', err => console.error('Error lector:', err));
});

nfc.on('error', err => console.error('Error NFC:', err));