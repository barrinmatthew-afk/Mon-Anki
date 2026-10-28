
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
    setDoc,
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

export async function loadCloudDecks() {
    const userRef = userDocument();

    if (!userRef) {
        return null;
    }

    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        return null;
    }

    const data = snapshot.data();

    return Array.isArray(data.decks)
        ? data.decks
        : [];
}


// ==============================
// SAUVEGARDE CLOUD DIFFÉRÉE
// ==============================

let pendingDecks = null;
let saveTimer = null;
let flushing = false;
let lastSaveError = null;


export function saveDecksToCloud(decks) {
    // Toujours renvoyer une Promise pour que les appels
    // .catch() dans script.js ne provoquent plus d'erreur.
    if (!auth.currentUser || !Array.isArray(decks)) {
        return Promise.resolve(false);
    }

    // Copie indépendante des données à sauvegarder.
    pendingDecks = JSON.parse(JSON.stringify(decks));

    if (saveTimer) {
        clearTimeout(saveTimer);
    }

    // Regrouper les changements rapides.
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void flushCloudSave();
    }, 500);

    // La demande est programmée ; les erreurs réelles de
    // Firestore restent gérées dans flushCloudSave().
    return Promise.resolve(true);
}



// ==============================
// ENVOYER LES DONNÉES EN ARRIÈRE-PLAN
// ==============================

async function flushCloudSave() {
    if (
        flushing ||
        !pendingDecks ||
        !auth.currentUser
    ) {
        return;
    }

    flushing = true;

    const decksSnapshot = pendingDecks;
    pendingDecks = null;

    try {
        const userRef = userDocument();

        if (userRef) {
            await setDoc(
                userRef,
                {
                    decks: decksSnapshot,
                    updatedAt: serverTimestamp()
                },
                {
                    merge: true
                }
            );

            lastSaveError = null;

            console.info(
                "Progression synchronisée avec Firestore."
            );
        }
    } catch (error) {
        lastSaveError = error;

        // Garder la sauvegarde pour réessayer plus tard.
        if (!pendingDecks) {
            pendingDecks = decksSnapshot;
        }

        console.warn(
            "Sauvegarde cloud en attente :",
            error
        );
    } finally {
        flushing = false;

        if (
            pendingDecks &&
            auth.currentUser &&
            !saveTimer
        ) {
            saveTimer = setTimeout(() => {
                saveTimer = null;
                void flushCloudSave();
            }, lastSaveError ? 2500 : 100);
        }
    }
}


// ==============================
// RÉESSAYER QUAND INTERNET REVIENT
// ==============================

window.addEventListener("online", () => {
    if (pendingDecks && !saveTimer) {
        saveTimer = setTimeout(() => {
            saveTimer = null;
            void flushCloudSave();
        }, 50);
    }
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

    return [...byName.values()];
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

export async function syncLocalDecksWithCloud(options = {}) {
    const user = await waitForAuth();

    window.cloudSyncReady = true;

    if (!user) {
        return;
    }

    if (syncPromise) {
        return syncPromise;
    }

    const task = (async () => {
        try {
            const before = localStorage.getItem("decks");

            if (before) {
                localStorage.setItem(
                    "decks_backup_before_cloud_sync",
                    before
                );
            }

            const cloudDecks = await loadCloudDecks();

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

            // L'envoi cloud est différé et ne bloque pas l'interface.
            saveDecksToCloud(merged);

            console.info(
                "Fusion locale/cloud terminée."
            );
        } catch (error) {
            console.warn(
                "Synchronisation indisponible. Les decks locaux restent utilisables :",
                error
            );
        }
    })();

    syncPromise = task;

    if (options.waitForCompletion === true) {
        await task;
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
