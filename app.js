// ==================== CONFIGURATION ====================
// À MODIFIER : Mettez l'URL de votre application Streamlit déployée
const API_URL = 'https://collectedechetscommunemekhe-backend-g8rwkxn8ccsakacdfkkappf.streamlit.app/';  // Remplacez par votre URL

const DB_NAME = 'CollecteDechetsDB';
const DB_VERSION = 1;
const STORE_NAME = 'collectes';

let db = null;
let isOnline = navigator.onLine;

// ==================== INITIALISATION INDEXEDDB ====================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// ==================== SAUVEGARDE LOCALE ====================
async function saveCollecteLocal(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const collecte = {
            ...data,
            synced: false,
            created_at: new Date().toISOString()
        };
        
        const request = store.add(collecte);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllCollectes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteCollecte(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function clearAllData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==================== SYNCHRONISATION ====================
async function syncWithServer() {
    if (!isOnline) {
        showToast("❌ Pas de connexion internet", "error");
        return;
    }
    
    const collectes = await getAllCollectes();
    const pending = collectes.filter(c => !c.synced);
    
    if (pending.length === 0) {
        showToast("✅ Aucune donnée en attente", "success");
        return;
    }
    
    showToast(`🔄 Synchronisation de ${pending.length} collecte(s)...`, "info");
    
    let synced = 0;
    let errors = 0;
    
    for (const collecte of pending) {
        try {
            const response = await fetch(`${API_URL}?sync=1&data=${encodeURIComponent(JSON.stringify(collecte))}`);
            
            if (response.ok) {
                await deleteCollecte(collecte.id);
                synced++;
            } else {
                errors++;
            }
        } catch (error) {
            errors++;
        }
    }
    
    if (errors === 0) {
        showToast(`✅ ${synced} collecte(s) synchronisée(s)`, "success");
    } else {
        showToast(`⚠️ ${synced} synchronisée(s), ${errors} erreur(s)`, "warning");
    }
    
    await updatePendingList();
    await updateHistoryList();
}

// ==================== AFFICHAGE ====================
function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (navigator.onLine) {
        statusEl.innerHTML = '📶 Connecté - Mode en ligne';
        statusEl.className = 'online';
    } else {
        statusEl.innerHTML = '⚠️ Hors ligne - Mode dégradé';
        statusEl.className = 'offline';
    }
    isOnline = navigator.onLine;
}

async function updatePendingList() {
    const collectes = await getAllCollectes();
    const pending = collectes.filter(c => !c.synced);
    const pendingCount = document.getElementById('pendingCount');
    const pendingList = document.getElementById('pendingList');
    
    pendingCount.innerHTML = `📦 En attente: ${pending.length} collecte(s)`;
    
    if (pending.length === 0) {
        pendingList.innerHTML = '<p class="text-center text-gray">Aucune collecte en attente</p>';
        return;
    }
    
    let html = '';
    for (const p of pending) {
        const totalVolume = (p.volume1 || 0) + (p.volume2 || 0);
        html += `
            <div class="point-item point-sync-pending">
                <strong>${p.quartier}</strong> - ${totalVolume} m³<br>
                📅 ${p.date} | 👤 ${p.agent}<br>
                <small>${new Date(p.created_at).toLocaleString()}</small>
            </div>
        `;
    }
    pendingList.innerHTML = html;
}

async function updateHistoryList() {
    const collectes = await getAllCollectes();
    const historyEl = document.getElementById('historyList');
    
    if (collectes.length === 0) {
        historyEl.innerHTML = '<p class="text-center text-gray">Aucune collecte enregistrée</p>';
        return;
    }
    
    let html = '';
    for (const c of collectes) {
        const totalVolume = (c.volume1 || 0) + (c.volume2 || 0);
        html += `
            <div class="point-item ${c.synced ? '' : 'point-sync-pending'}">
                <strong>${c.quartier}</strong> - ${totalVolume} m³<br>
                📅 ${c.date} | 👤 ${c.agent}<br>
                ${c.synced ? '✅ Synchronisé' : '⏳ En attente'}<br>
                <small>${new Date(c.created_at).toLocaleString()}</small>
            </div>
        `;
    }
    historyEl.innerHTML = html;
}

// ==================== EXPORT CSV ====================
async function exportCSV() {
    const collectes = await getAllCollectes();
    
    if (collectes.length === 0) {
        showToast("Aucune donnée à exporter", "warning");
        return;
    }
    
    const headers = ['Date', 'Quartier', 'Équipe', 'Agent', 'Volume1 (m³)', 'Volume2 (m³)', 'Total (m³)', 'Observations', 'Synchro', 'Créé le'];
    const rows = collectes.map(c => [
        c.date, c.quartier, c.equipe, c.agent,
        c.volume1 || 0, c.volume2 || 0, (c.volume1 || 0) + (c.volume2 || 0),
        c.observations || '', c.synced ? 'Oui' : 'Non', c.created_at
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `collectes_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast("📥 Export CSV terminé", "success");
}

// ==================== GPS AUTOMATIQUE ====================
let gpsWatchId = null;
let currentPosition = null;

function startGPS() {
    if (!navigator.geolocation) {
        showToast("❌ GPS non supporté", "error");
        return;
    }
    
    showToast("📍 Activation du GPS...", "info");
    
    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            currentPosition = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            // Mettre à jour les champs automatiquement
            document.getElementById('pointLat').value = currentPosition.lat.toFixed(6);
            document.getElementById('pointLon').value = currentPosition.lon.toFixed(6);
            document.getElementById('pointAccuracy').value = currentPosition.accuracy.toFixed(0);
            
            // Mettre à jour l'affichage du statut
            const statusBar = document.getElementById('statusBar');
            const gpsStatus = document.createElement('span');
            gpsStatus.id = 'gpsStatus';
            gpsStatus.innerHTML = `📍 GPS actif (${currentPosition.accuracy.toFixed(0)}m)`;
            gpsStatus.style.color = '#4CAF50';
            gpsStatus.style.fontSize = '10px';
            
            const existingGPS = document.getElementById('gpsStatus');
            if (existingGPS) existingGPS.remove();
            statusBar.appendChild(gpsStatus);
            
            showToast(`📍 GPS actif - Précision: ${currentPosition.accuracy.toFixed(0)}m`, "success");
        },
        (error) => {
            console.error("Erreur GPS:", error);
            showToast(`❌ Erreur GPS: ${error.message}`, "error");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function stopGPS() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
        const gpsStatus = document.getElementById('gpsStatus');
        if (gpsStatus) gpsStatus.remove();
        showToast("📍 GPS désactivé", "info");
    }
}

// ==================== MODIFICATION DE updatePointsList ====================
async function updatePointsList() {
    const collectes = await getAllCollectes();
    const collecteEnCours = collectes.find(c => !c.synced);
    const pointsList = document.getElementById('pointsList');
    
    if (!collecteEnCours || !collecteEnCours.points || collecteEnCours.points.length === 0) {
        pointsList.innerHTML = '<p class="text-center text-gray">Aucun point enregistré pour cette collecte</p>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < collecteEnCours.points.length; i++) {
        const p = collecteEnCours.points[i];
        html += `
            <div class="point-item">
                <strong>Point ${i+1}</strong> - ${p.type}<br>
                📍 ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}<br>
                🎯 Précision: ${p.accuracy || 'N/A'} m<br>
                📝 ${p.description || 'Pas de description'}<br>
                <small>${new Date(p.heure).toLocaleString()}</small>
            </div>
        `;
    }
    pointsList.innerHTML = html;
}

// ==================== MODIFICATION DE ajouterPoint ====================
async function ajouterPoint() {
    // Récupérer les coordonnées automatiques
    const lat = document.getElementById('pointLat').value;
    const lon = document.getElementById('pointLon').value;
    const accuracy = document.getElementById('pointAccuracy').value;
    const type = document.getElementById('pointType').value;
    const description = document.getElementById('pointDesc').value;
    
    if (!lat || !lon) {
        showToast("❌ Position GPS non disponible. Activez le GPS.", "error");
        return;
    }
    
    const collectes = await getAllCollectes();
    const collecteEnCours = collectes.find(c => !c.synced);
    
    if (collecteEnCours) {
        collecteEnCours.points = collecteEnCours.points || [];
        collecteEnCours.points.push({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            accuracy: parseFloat(accuracy) || 0,
            type: type,
            description: description,
            heure: new Date().toISOString()
        });
        
        await deleteCollecte(collecteEnCours.id);
        await saveCollecteLocal(collecteEnCours);
        
        showToast(`✅ Point ajouté à la collecte ${type}`, "success");
    } else {
        showToast("⚠️ Aucune collecte en cours. Créez d'abord une collecte.", "warning");
        return;
    }
    
    document.getElementById('pointDesc').value = '';
    
    await updatePointsList();
}

// ==================== MODIFICATION DE initEvents ====================
function initEvents() {
    document.getElementById('btnEnregistrer').onclick = enregistrerCollecte;
    document.getElementById('btnEnregistrerGPS').onclick = () => {
        if (gpsWatchId === null) {
            startGPS();
        } else {
            stopGPS();
        }
    };
    document.getElementById('btnAjouterPoint').onclick = ajouterPoint;
    document.getElementById('btnSyncNow').onclick = syncWithServer;
    document.getElementById('btnExportCSV').onclick = exportCSV;
    document.getElementById('btnClearAll').onclick = async () => {
        if (confirm("⚠️ Êtes-vous sûr de vouloir effacer TOUTES les données locales ?")) {
            await clearAllData();
            showToast("🗑️ Toutes les données locales ont été effacées", "warning");
            await updatePendingList();
            await updateHistoryList();
            await updatePointsList();
        }
    };
    
    // Ajouter le bouton GPS
    const btnGPS = document.getElementById('btnGetGPSPosition');
    if (btnGPS) {
        btnGPS.onclick = () => {
            if (gpsWatchId === null) {
                startGPS();
            } else {
                stopGPS();
            }
        };
    }
    
    // ... reste du code inchangé
}

// ==================== ENREGISTREMENT ====================
async function enregistrerCollecte() {
    const dateCollecte = document.getElementById('dateCollecte').value;
    const quartier = document.getElementById('quartier').value;
    const equipe = document.getElementById('equipe').value;
    const agentNom = document.getElementById('agentNom').value;
    const volume1 = parseFloat(document.getElementById('volume1').value) || 0;
    const volume2 = parseFloat(document.getElementById('volume2').value) || 0;
    const heureDepart = document.getElementById('heureDepart').value;
    const heureRetour = document.getElementById('heureRetour').value;
    const observations = document.getElementById('observations').value;
    
    if (!dateCollecte || !agentNom) {
        showToast("❌ Veuillez remplir les champs obligatoires", "error");
        return;
    }
    
    const collecte = {
        date: dateCollecte,
        quartier: quartier,
        equipe: equipe,
        agent: agentNom,
        volume1: volume1,
        volume2: volume2,
        heureDepart: heureDepart,
        heureRetour: heureRetour,
        observations: observations,
        points: []
    };
    
    await saveCollecteLocal(collecte);
    
    document.getElementById('volume1').value = '';
    document.getElementById('volume2').value = '';
    document.getElementById('observations').value = '';
    
    showToast(`✅ Collecte enregistrée localement pour ${quartier}`, "success");
    
    await updatePendingList();
    await updateHistoryList();
    
    if (navigator.onLine) {
        await syncWithServer();
    } else {
        showToast("💾 Donnée enregistrée localement. Sera synchronisée plus tard.", "info");
    }
}

async function ajouterPoint() {
    const lat = document.getElementById('pointLat').value;
    const lon = document.getElementById('pointLon').value;
    const type = document.getElementById('pointType').value;
    const description = document.getElementById('pointDesc').value;
    
    if (!lat || !lon) {
        showToast("❌ Veuillez entrer les coordonnées GPS", "error");
        return;
    }
    
    const collectes = await getAllCollectes();
    const collecteEnCours = collectes.find(c => !c.synced);
    
    if (collecteEnCours) {
        collecteEnCours.points = collecteEnCours.points || [];
        collecteEnCours.points.push({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            type: type,
            description: description,
            heure: new Date().toISOString()
        });
        
        await deleteCollecte(collecteEnCours.id);
        await saveCollecteLocal(collecteEnCours);
        
        showToast("✅ Point ajouté à la collecte en cours", "success");
    } else {
        showToast("⚠️ Aucune collecte en cours. Créez d'abord une collecte.", "warning");
        return;
    }
    
    document.getElementById('pointLat').value = '';
    document.getElementById('pointLon').value = '';
    document.getElementById('pointDesc').value = '';
    
    await updatePointsList();
}

async function updatePointsList() {
    const collectes = await getAllCollectes();
    const collecteEnCours = collectes.find(c => !c.synced);
    const pointsList = document.getElementById('pointsList');
    
    if (!collecteEnCours || !collecteEnCours.points || collecteEnCours.points.length === 0) {
        pointsList.innerHTML = '<p class="text-center text-gray">Aucun point enregistré pour cette collecte</p>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < collecteEnCours.points.length; i++) {
        const p = collecteEnCours.points[i];
        html += `
            <div class="point-item">
                <strong>Point ${i+1}</strong> - ${p.type}<br>
                📍 ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}<br>
                📝 ${p.description || 'Pas de description'}<br>
                <small>${new Date(p.heure).toLocaleString()}</small>
            </div>
        `;
    }
    pointsList.innerHTML = html;
}

// ==================== TOAST ====================
function showToast(message, type = "info") {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    
    if (type === "error") toast.style.background = "#f44336";
    else if (type === "success") toast.style.background = "#4CAF50";
    else if (type === "warning") toast.style.background = "#FF9800";
    else toast.style.background = "#333";
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== ÉVÉNEMENTS ====================
function initEvents() {
    document.getElementById('btnEnregistrer').onclick = enregistrerCollecte;
    document.getElementById('btnEnregistrerGPS').onclick = enregistrerAvecGPS;
    document.getElementById('btnAjouterPoint').onclick = ajouterPoint;
    document.getElementById('btnSyncNow').onclick = syncWithServer;
    document.getElementById('btnExportCSV').onclick = exportCSV;
    document.getElementById('btnClearAll').onclick = async () => {
        if (confirm("⚠️ Êtes-vous sûr de vouloir effacer TOUTES les données locales ?")) {
            await clearAllData();
            showToast("🗑️ Toutes les données locales ont été effacées", "warning");
            await updatePendingList();
            await updateHistoryList();
            await updatePointsList();
        }
    };
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            
            if (tab.dataset.tab === 'sync') updatePendingList();
            if (tab.dataset.tab === 'historique') updateHistoryList();
            if (tab.dataset.tab === 'points') updatePointsList();
        };
    });
    
    window.addEventListener('online', () => {
        updateConnectionStatus();
        showToast("🔄 Connexion rétablie, synchronisation...", "success");
        syncWithServer();
    });
    
    window.addEventListener('offline', () => {
        updateConnectionStatus();
        showToast("⚠️ Mode hors ligne", "warning");
    });
    
    document.getElementById('dateCollecte').value = new Date().toISOString().slice(0,10);
}

// ==================== DÉMARRAGE ====================
async function init() {
    await initDB();
    updateConnectionStatus();
    await updatePendingList();
    await updateHistoryList();
    await updatePointsList();
    initEvents();
    
    if (navigator.onLine) {
        setTimeout(syncWithServer, 2000);
    }
}

init();
