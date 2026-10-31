
// ==============================
// FIREBASE — MON ANKI
// Sauvegarde locale prioritaire + synchronisation différée
// ==============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    doc,
    getDoc,
    getDocFromServer,
    setDoc,
    deleteDoc,
    deleteField,
    serverTimestamp,
    onSnapshot,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ==============================
// CONFIGURATION FIREBASE
// ==============================

const firebaseConfig = {
    apiKey: "AIzaSyDN5sEmYBBwAvJuE_03Pv59cPcdVMpVM54",
    authDomain: "mon-anki.firebaseapp.com",
    projectId: "mon-anki",
    storageBucket: "mon-anki.firebasestorage.app",
    messagingSenderId: "221401653253",
    appId: "1:221401653253:web:fe40dc3753fa880020fc6c"
};


// ==============================
// INITIALISATION
// ==============================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let db;

try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache()
    });
} catch (error) {
    console.warn(
        "Cache Firestore persistant indisponible :",
        error
    );

    db = getFirestore(app);
}

const provider = new GoogleAuthProvider();


// ==============================
// CONNEXION GOOGLE
// ==============================

export async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Erreur de connexion :", error);
        throw error;
    }
}


// ==============================
// DÉCONNEXION
// ==============================

export async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erreur de déconnexion :", error);
        throw error;
    }
}


// ==============================
// ATTENDRE L'ÉTAT DE CONNEXION
// ==============================

export function waitForAuth() {
    return new Promise(resolve => {
        const unsubscribe = onAuthStateChanged(
            auth,
            user => {
                unsubscribe();
                resolve(user);
            },
            error => {
                unsubscribe();

                console.warn(
                    "État de connexion indisponible :",
                    error
                );

                resolve(auth.currentUser || null);
            }
        );
    });
}


// ==============================
// UTILISATEUR ACTUEL
// ==============================

export function getCurrentUser() {
    return auth.currentUser;
}


// ==============================
// RÉFÉRENCE DU DOCUMENT UTILISATEUR
// ==============================

function userDocument() {
    const user = auth.currentUser;

    if (!user) {
        return null;
    }

    return doc(db, "users", user.uid);
}


// ==============================
// CHARGER LES DECKS DU CLOUD
// ==============================

let cloudDeletedDeckNames = [];
let cloudDeletedCardKeys = [];

async function runWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, limit), items.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    }));

    return results;
}

export async function loadCloudDecks(options = {}) {
    const user = auth.currentUser;
    const userRef = userDocument();

    if (!user || !userRef) return null;

    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const snapshot = await getDocFromServer(userRef);
    const data = snapshot.exists() ? snapshot.data() : {};

    cloudDeletedDeckNames = Array.isArray(data.deletedDeckNames) ? data.deletedDeckNames : [];
    cloudDeletedCardKeys = Array.isArray(data.deletedCardKeys) ? data.deletedCardKeys : [];

    const byName = new Map();
    const legacyDecks = Array.isArray(data.decks) ? data.decks : [];
    legacyDecks.forEach(deck => {
        if (deck && typeof deck.name === "string") byName.set(deck.name, deck);
    });

    const deckSnapshots = await getDocs(collection(db, "users", user.uid, "decks"));
    const validDeckSnapshots = deckSnapshots.docs.filter(item => {
        const stored = item.data();
        return stored && typeof stored.name === "string" && stored.deck;
    });
    const totalCards = validDeckSnapshots.reduce((sum, item) => {
        return sum + Math.max(0, Number(item.data().cardCount) || 0);
    }, 0);

    let completedCards = 0;
    onProgress?.({ phase: "download", completed: 0, total: totalCards });

    const downloadedDecks = await runWithConcurrency(validDeckSnapshots, 4, async deckSnapshot => {
        const stored = deckSnapshot.data();
        const partsSnapshot = await getDocs(collection(db, "users", user.uid, "decks", deckSnapshot.id, "parts"));
        const parts = partsSnapshot.docs
            .map(part => ({ id: part.id, data: part.data() }))
            .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        const cards = parts.flatMap(part => Array.isArray(part.data.cards) ? part.data.cards : []);

        completedCards += cards.length;
        onProgress?.({
            phase: "download",
            completed: Math.min(completedCards, totalCards || completedCards),
            total: totalCards || completedCards,
            deckName: stored.name
        });

        return { ...stored.deck, name: stored.name, cards };
    });

    downloadedDecks.forEach(deck => byName.set(deck.name, deck));
    return [...byName.values()];
}


// ==============================
// ==============================
// SAUVEGARDE CLOUD DIFFÉRÉE
// ==============================

const PENDING_CLOUD_KEY = "monanki_pending_cloud_decks";
let pendingDecks = null;
let saveTimer = null;
let activeFlushPromise = null;
let lastSaveError = null;
let pendingSaveResolvers = [];
let pendingProgressCallback = null;

// Restaurer la dernière sauvegarde en attente après un rechargement ou une fermeture.
try {
    // Le marqueur indique qu'un envoi reste à faire. Les données elles-mêmes
    // sont déjà dans "decks" : on évite d'en stocker une seconde copie volumineuse.
    if (localStorage.getItem(PENDING_CLOUD_KEY)) {
        const localDecks = JSON.parse(localStorage.getItem("decks") || "[]");
        pendingDecks = Array.isArray(localDecks) ? localDecks : null;
    }
} catch (error) {
    console.warn("File d'attente cloud illisible :", error);
    pendingDecks = null;
}

function persistPendingDecks() {
    try {
        if (Array.isArray(pendingDecks)) {
            localStorage.setItem(PENDING_CLOUD_KEY, "1");
        } else {
            localStorage.removeItem(PENDING_CLOUD_KEY);
        }
    } catch (error) {
        console.warn("Impossible de conserver le marqueur de file cloud :", error);
    }
}

function scheduleCloudSave(delay = 1200) {
    if (saveTimer) clearTimeout(saveTimer);
    if (!pendingDecks || !auth.currentUser || !navigator.onLine) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void flushCloudSave();
    }, delay);
}

export function saveDecksToCloud(decks, options = {}) {
    if (!Array.isArray(decks)) return Promise.resolve(false);

    // Garder la dernière version complète : elle inclut toutes les modifications précédentes.
    pendingDecks = JSON.parse(JSON.stringify(decks));
    pendingProgressCallback = typeof options.onProgress === "function" ? options.onProgress : null;
    persistPendingDecks();

    // Pas de tentative réseau sans compte ou sans connexion. La file reste persistante.
    if (!auth.currentUser || !navigator.onLine) return Promise.resolve(false);

    const completion = new Promise(resolve => {
        pendingSaveResolvers.push({ resolve });
    });
    scheduleCloudSave();
    return completion;
}


// ==============================
// ENVOYER LES DONNÉES EN ARRIÈRE-PLAN
// ==============================

async function flushCloudSave() {
    if (activeFlushPromise) return activeFlushPromise;
    if (!Array.isArray(pendingDecks)) return true;
    if (!auth.currentUser || !navigator.onLine) return false;

    const decksSnapshot = pendingDecks;
    const resolversForSnapshot = pendingSaveResolvers.splice(0);
    const progressCallback = pendingProgressCallback;
    pendingDecks = null;
    pendingProgressCallback = null;

    const task = (async () => {
        try {
            const user = auth.currentUser;
            const userRef = userDocument();
            if (!user || !userRef) throw new Error("Aucun compte Google connecté.");

            const validDecks = decksSnapshot.filter(deck => deck && typeof deck.name === "string");
            const totalCards = validDecks.reduce((sum, deck) => {
                return sum + (Array.isArray(deck.cards) ? deck.cards.length : 0);
            }, 0);
            let completedCards = 0;
            progressCallback?.({ phase: "upload", completed: 0, total: totalCards });

            await runWithConcurrency(validDecks, 3, async deck => {
                const deckId = encodeURIComponent(deck.name);
                const deckRef = doc(db, "users", user.uid, "decks", deckId);
                const allCards = Array.isArray(deck.cards) ? deck.cards : [];
                const { cards: ignoredCards, ...deckMetadata } = deck;
                const chunks = [];
                for (let i = 0; i < allCards.length; i += 50) {
                    chunks.push(allCards.slice(i, i + 50));
                }

                await setDoc(deckRef, {
                    name: deck.name,
                    deck: deckMetadata,
                    cardCount: allCards.length,
                    updatedAt: serverTimestamp()
                });

                const oldParts = await getDocs(collection(db, "users", user.uid, "decks", deckId, "parts"));
                const obsoleteParts = oldParts.docs.filter(part => {
                    const partNumber = Number(part.id.replace("part_", ""));
                    return !Number.isInteger(partNumber) || partNumber >= chunks.length;
                });
                await runWithConcurrency(obsoleteParts, 6, part => deleteDoc(part.ref));

                await runWithConcurrency(chunks, 6, async (chunk, index) => {
                    const partId = "part_" + String(index).padStart(5, "0");
                    await setDoc(doc(db, "users", user.uid, "decks", deckId, "parts", partId), {
                        cards: chunk,
                        updatedAt: serverTimestamp()
                    });
                    completedCards += chunk.length;
                    progressCallback?.({
                        phase: "upload",
                        completed: Math.min(completedCards, totalCards),
                        total: totalCards,
                        deckName: deck.name
                    });
                });
            });

            const deletedDeckNames = JSON.parse(localStorage.getItem("monanki_deleted_deck_names") || "[]");
            const deletedCardKeys = JSON.parse(localStorage.getItem("monanki_deleted_card_keys") || "[]");

            await setDoc(userRef, {
                decks: deleteField(),
                deletedDeckNames: [...new Set([...cloudDeletedDeckNames, ...deletedDeckNames])],
                deletedCardKeys: [...new Set([...cloudDeletedCardKeys, ...deletedCardKeys])],
                updatedAt: serverTimestamp()
            }, { merge: true });

            lastSaveError = null;
            if (pendingDecks === null) {
                localStorage.removeItem(PENDING_CLOUD_KEY);
            } else {
                persistPendingDecks();
            }

            resolversForSnapshot.forEach(({ resolve }) => resolve(true));
            console.info("Progression synchronisée avec Firestore.");
            return true;
        } catch (error) {
            lastSaveError = error;
            if (pendingDecks === null) pendingDecks = decksSnapshot;
            persistPendingDecks();
            resolversForSnapshot.forEach(({ resolve }) => resolve(false));
            console.warn("Sauvegarde cloud en attente :", error);
            return false;
        }
    })();

    activeFlushPromise = task;
    try {
        return await task;
    } finally {
        activeFlushPromise = null;
        if (pendingDecks !== null && auth.currentUser && navigator.onLine && !saveTimer) {
            scheduleCloudSave(lastSaveError ? 15000 : 500);
        }
    }
}

// Appelée explicitement à la fin d'une session. Elle attend la confirmation Firestore,
// mais ne bloque pas indéfiniment l'utilisateur si le réseau est lent ou indisponible.
export async function flushPendingCloudSave() {
    if (!auth.currentUser || !navigator.onLine) return false;
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    let timeoutId;
    const result = await Promise.race([
        flushCloudSave(),
        new Promise(resolve => {
            timeoutId = setTimeout(() => resolve(null), 10000);
        })
    ]);
    clearTimeout(timeoutId);
    return result === true;
}


// ==============================
// RÉESSAYER QUAND INTERNET REVIENT
// ==============================

window.addEventListener("online", () => scheduleCloudSave(800));
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleCloudSave(500);
});

onAuthStateChanged(auth, user => {
    if (user) scheduleCloudSave(500);
});


// ==============================
// FUSION DES DECKS
// ==============================

function cardKey(card, index) {
    if (card && card.id != null) {
        return `id:${card.id}`;
    }

    // Les anciennes cartes n'ont pas toujours d'identifiant.
    // Leur position peut changer entre appareils : on utilise donc
    // leur contenu pour retrouver la même carte dans les deux listes.
    const word = String(card?.word ?? "").trim().toLocaleLowerCase();
    const answer = String(card?.answer ?? "").trim().toLocaleLowerCase();
    const mode = String(card?.mode ?? "").trim().toLocaleLowerCase();

    if (word || answer) {
        return `legacy:${JSON.stringify([word, answer, mode])}`;
    }

    // Dernier recours pour les cartes sans contenu identifiable.
    return `legacy-index:${index}`;
}

function cardKeys(cards) {
    const occurrences = new Map();

    return cards.map((card, index) => {
        const baseKey = cardKey(card, index);
        const occurrence = occurrences.get(baseKey) || 0;

        occurrences.set(baseKey, occurrence + 1);

        // Préserve les doublons éventuels d'une même carte.
        return `${baseKey}#${occurrence}`;
    });
}


function chooseCard(localCard, cloudCard) {
    if (!localCard) {
        return { ...cloudCard };
    }

    if (!cloudCard) {
        return { ...localCard };
    }

    const localTime = Number(localCard.updatedAt || 0);
    const cloudTime = Number(cloudCard.updatedAt || 0);

    // En cas de doute, les données locales sont conservées.
    if (cloudTime > localTime) {
        return { ...localCard, ...cloudCard };
    }

    return { ...cloudCard, ...localCard };
}


function mergeDeckLists(localDecks, cloudDecks) {
    if (!Array.isArray(localDecks)) {
        localDecks = [];
    }

    if (!Array.isArray(cloudDecks)) {
        cloudDecks = [];
    }

    const byName = new Map();

    // Charger d'abord les decks du cloud.
    for (const cloudDeck of cloudDecks) {
        if (
            !cloudDeck ||
            typeof cloudDeck.name !== "string"
        ) {
            continue;
        }

        byName.set(
            cloudDeck.name,
            {
                ...cloudDeck,
                cards: Array.isArray(cloudDeck.cards)
                    ? [...cloudDeck.cards]
                    : []
            }
        );
    }

    // Ajouter les decks locaux et fusionner les cartes.
    for (const localDeck of localDecks) {
        if (
            !localDeck ||
            typeof localDeck.name !== "string"
        ) {
            continue;
        }

        const cloudDeck = byName.get(localDeck.name);

        if (!cloudDeck) {
            byName.set(
                localDeck.name,
                {
                    ...localDeck,
                    cards: Array.isArray(localDeck.cards)
                        ? [...localDeck.cards]
                        : []
                }
            );

            continue;
        }

        const cloudCards = Array.isArray(cloudDeck.cards)
            ? cloudDeck.cards
            : [];

        const localCards = Array.isArray(localDeck.cards)
            ? localDeck.cards
            : [];

        const cloudByKey = new Map();
        const cloudKeys = cardKeys(cloudCards);
        const localKeys = cardKeys(localCards);

        cloudCards.forEach((card, index) => {
            cloudByKey.set(cloudKeys[index], card);
        });

        const mergedCards = [];
        const seen = new Set();

        localCards.forEach((card, index) => {
            const key = localKeys[index];
            const cloudCard = cloudByKey.get(key);

            mergedCards.push(
                chooseCard(card, cloudCard)
            );

            seen.add(key);
        });

        cloudCards.forEach((card, index) => {
            const key = cloudKeys[index];

            if (!seen.has(key)) {
                mergedCards.push({ ...card });
            }
        });

        byName.set(
            localDeck.name,
            {
                ...cloudDeck,
                ...localDeck,
                cards: mergedCards
            }
        );
    }

    const deletedDeckNames = new Set([
        ...cloudDeletedDeckNames,
        ...JSON.parse(localStorage.getItem("monanki_deleted_deck_names") || "[]")
    ]);
    const deletedCardKeys = new Set([
        ...cloudDeletedCardKeys,
        ...JSON.parse(localStorage.getItem("monanki_deleted_card_keys") || "[]")
    ]);

    // Les suppressions explicites priment sur les copies présentes sur l'autre appareil.
    for (const deletedName of deletedDeckNames) byName.delete(deletedName);

    for (const [name, deck] of byName.entries()) {
        deck.cards = (Array.isArray(deck.cards) ? deck.cards : []).filter(card => {
            const key = makeDeletedCardKey(name, card);
            return !deletedCardKeys.has(key);
        });
    }

    return [...byName.values()];
}

function makeDeletedCardKey(deckName, card) {
    const word = String(card?.word ?? "").trim().toLocaleLowerCase();
    const answer = String(card?.answer ?? "").trim().toLocaleLowerCase();
    const mode = String(card?.mode ?? "").trim().toLocaleLowerCase();
    return JSON.stringify([deckName, word, answer, mode]);
}


// ==============================
// ENREGISTREMENT LOCAL
// ==============================

function writeLocalDecks(decks) {
    try {
        localStorage.setItem(
            "decks",
            JSON.stringify(decks)
        );

        // Informer l’accueil que les données distantes ont été fusionnées.
        window.dispatchEvent(new CustomEvent("cloudDecksSynced"));
        return true;
    } catch (error) {
        console.error(
            "Impossible d'enregistrer les decks localement :",
            error
        );

        return false;
    }
}


// ==============================
// SYNCHRONISATION INITIALE
// ==============================

let syncPromise = null;
let lastSyncError = null;

export async function syncLocalDecksWithCloud(options = {}) {
    const user = await waitForAuth();

    window.cloudSyncReady = true;

    if (!user) {
        return;
    }

    if (syncPromise) {
        const existingResult = await syncPromise;
        if (options.waitForCompletion === true && existingResult === false) {
            throw lastSyncError || new Error("La synchronisation cloud a échoué. Les données locales sont conservées.");
        }
        return existingResult;
    }

    lastSyncError = null;
    window.cloudSyncLastError = null;

    const task = (async () => {
        try {
            const before = localStorage.getItem("decks");

            if (before) {
                localStorage.setItem(
                    "decks_backup_before_cloud_sync",
                    before
                );
            }

            const cloudDecks = await loadCloudDecks({
                onProgress: progress => options.onProgress?.(progress)
            });

            // Relire les données locales après l'attente réseau :
            // elles ont pu changer pendant ce temps.
            const latestLocalRaw = localStorage.getItem("decks");

            let localDecks = [];

            try {
                localDecks = latestLocalRaw
                    ? JSON.parse(latestLocalRaw)
                    : [];
            } catch (error) {
                console.warn(
                    "Impossible de lire les decks locaux :",
                    error
                );
            }

            let merged;

            if (cloudDecks === null) {
                merged = Array.isArray(localDecks)
                    ? localDecks
                    : [];
            } else {
                merged = mergeDeckLists(
                    localDecks,
                    cloudDecks
                );
            }

            writeLocalDecks(merged);

            // Attendre la confirmation réelle de Firestore avant d'annoncer la réussite.
            const cloudSaved = await saveDecksToCloud(merged, {
                onProgress: progress => options.onProgress?.(progress)
            });
            if (cloudSaved !== true) {
                throw lastSaveError || new Error("Les données sont conservées localement et seront synchronisées dès que possible.");
            }

            console.info(
                "Fusion locale/cloud terminée et enregistrée dans le cloud."
            );
            return true;
        } catch (error) {
            lastSyncError = error;
            // Exposer temporairement le détail pour que l'interface puisse l'afficher.
            window.cloudSyncLastError = {
                code: error?.code || "",
                name: error?.name || "Error",
                message: error?.message || String(error),
                stack: error?.stack || ""
            };
            console.warn(
                "Synchronisation indisponible. Les decks locaux restent utilisables :",
                error
            );
            return false;
        }
    })();

    syncPromise = task;

    if (options.waitForCompletion === true) {
        const success = await task;
        if (success === false) {
            throw lastSyncError || new Error("La synchronisation cloud a échoué. Les données locales sont conservées.");
        }
    } else {
        // Ne pas bloquer indéfinimeant l'ouverture sur un réseau lent.
        await Promise.race([
            task,
            new Promise(resolve => {
                setTimeout(resolve, 1500);
            })
        ]);
    }

    task.finally(() => {
        if (syncPromise === task) {
            syncPromise = null;
        }
    });
}


// ==============================
// SAUVEGARDE ACCESSIBLE AUX AUTRES SCRIPTS
// ==============================

window.saveDecksToCloud = saveDecksToCloud;
window.flushDecksToCloud = flushPendingCloudSave;


/* ==============================
   SYNCHRONISATION MANUELLE
============================== */
// Pas de réception automatique en arrière-plan.
// Les changements venant d'un autre appareil sont récupérés
// quand l'utilisateur appuie sur « Actualiser / synchroniser ».


// Statistiques de temps d'étude, séparées par jour et appareil.
export async function saveStudyTime(date, deviceId, seconds, subjectSeconds = {}) {
    const user = auth.currentUser;
    if (!user || !date || !deviceId || !Number.isFinite(seconds)) return false;
    const statsRef = doc(db, "users", user.uid, "studyStats", date + "_" + deviceId);
    const cleanSubjects = {};
    Object.entries(subjectSeconds || {}).forEach(([name, value]) => {
        if (name && Number.isFinite(Number(value))) cleanSubjects[name] = Math.max(0, Math.floor(Number(value)));
    });
    await setDoc(statsRef, {
        date,
        deviceId,
        seconds: Math.max(0, Math.floor(seconds)),
        subjectSeconds: cleanSubjects,
        updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
}

export async function loadStudyTimeStats() {
    const user = auth.currentUser;
    if (!user) return null;
    const snapshot = await getDocs(collection(db, "users", user.uid, "studyStats"));
    return snapshot.docs.map(item => item.data());
}
