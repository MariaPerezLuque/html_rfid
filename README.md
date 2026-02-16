# 🆔 Sistema de Control de Acceso RFID (Admira)

Este proyecto es un sistema de lectura y gestión de tarjetas RFID diseñado para controlar el acceso mediante una interfaz web sencilla. Permite registrar nuevos usuarios (tarjetas/llaveros) y validar su acceso en tiempo real.

---

## 🚨 IMPORTANTE: Ubicación del Proyecto

Para el correcto funcionamiento de los scripts de automatización y las rutas relativas, **este proyecto debe estar ubicado obligatoriamente en la siguiente ruta:**

C:/admira/conditions

> ⚠️ **Nota:** Si se mueve la carpeta a otra ubicación (por ejemplo, al Escritorio o Descargas), el sistema podría no encontrar los archivos de configuración necesarios.

---

## 🟢 GUÍA DE USUARIO

Instrucciones sencillas para encender y utilizar el sistema día a día.

### 🚀 1. Cómo iniciar el sistema
1. Asegúrate de que el **Lector RFID USB** esté conectado al ordenador.
2. Ve a la carpeta `C:/admira/conditions`.
3. Busca el archivo llamado **`INICIAR_RFID.bat`** (puede aparecer como "INICIAR_RFID").
4. Haz **doble clic** sobre él.
   - Se abrirá una ventana negra pequeña (es el motor del sistema, **no la cierres**).
   - Automáticamente se abrirá el navegador con la pantalla de control.

### 📝 2. Cómo registrar una tarjeta nueva
1. Acerca una tarjeta o llavero **nuevo** al lector.
2. La pantalla te mostrará una alerta amarilla de "Tarjeta Nueva".
3. Escribe el **alias de la tarjeta** en el recuadro que aparece.
4. Haz clic en **Guardar**.
5. ¡Listo! La tarjeta ha quedado registrada en la base de datos.

### ✅ 3. Cómo verificar una entrada
1. Acerca una tarjeta ya registrada.
2. Si la tarjeta es válida, la pantalla se pondrá **Verde** y mostrará el nombre del usuario y el mensaje "Acceso Permitido".
3. Para volver a escanear otra tarjeta, pulsa el botón **"Continuar"**.

---

## 🟠 GUÍA TÉCNICA (Para Desarrolladores / IT)

Información sobre la arquitectura, archivos y funcionamiento interno del código.

### 🛠 Arquitectura del Sistema
Debido a las restricciones de seguridad de los navegadores web modernos (que impiden el acceso directo a hardware USB/SmartCard), este sistema utiliza una arquitectura **Cliente-Servidor Local**:

1.  **Backend (Node.js):** Se ejecuta en local y utiliza la librería `nfc-pcsc` para comunicarse nativamente con el lector USB.
2.  **Frontend (HTML/JS):** Una interfaz web limpia que se conecta al Backend mediante **WebSockets** (Puerto `3000`).
3.  **Persistencia:** Los datos se guardan en un archivo JSON local.

### 📂 Estructura de Archivos

| Archivo | Descripción Técnica |
| :--- | :--- |
| **`INICIAR_RFID.bat`** | Script de arranque (Batch). Inicia el servidor Node.js y lanza el navegador apuntando al `index.html`. Utiliza rutas relativas, por lo que depende de estar en la carpeta correcta. |
| **`bridge.js`** | **El Núcleo.** Script de Node.js que: <br>1. Escucha eventos del lector RFID (PC/SC). <br>2. Gestiona el servidor WebSocket. <br>3. Lee/Escribe en `aliases.json`. |
| **`index.html`** | **La Interfaz.** Single Page Application (SPA) sencilla. Contiene todo el HTML, CSS y lógica JS de cliente. No tiene lógica de negocio, solo visualización y envío de comandos al socket. |
| **`aliases.json`** | **Base de Datos.** Archivo JSON simple que almacena los pares `UID: Nombre`. Se crea automáticamente si no existe. |
| **`package.json`** | Define las dependencias del proyecto (`nfc-pcsc`, `ws`). |

### ⚙️ Instalación en un equipo nuevo
Si necesitas reinstalar el sistema en un ordenador:

1.  Crea la carpeta: `C:/admira/conditions`.
2.  Copia todos los archivos del repositorio en esa carpeta.
3.  Instala **Node.js**.
4.  Abre una terminal en esa carpeta y ejecuta:
    ```bash
    npm install
    ```
    *(Esto descargará `node_modules` y compilará las librerías nativas para el lector).*
5.  Ejecuta `node bridge.js` para probar que detecta el lector.

### 🐛 Solución de Problemas Comunes
* **Error "SmartCard Resource Manager is not running":** El servicio de tarjetas inteligentes de Windows está detenido. Reinicia el servicio o el PC.
* **La pantalla se queda en "Desconectado":** Asegúrate de que la ventana negra (Node.js) sigue abierta. Si se cerró, ejecuta `INICIAR_RFID.bat` de nuevo.