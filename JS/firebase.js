// ==============================
// FIREBASE — MON ANKI
// ==============================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
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

const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const db =
    getFirestore(app);

const provider =
    new GoogleAuthProvider();


// ==============================
// CONNEXION GOOGLE
// ==============================

export async function loginWithGoogle() {

    try {

        await signInWithPopup(
            auth,
            provider
        );

    } catch (error) {

        console.error(
            "Erreur de connexion :",
            error
        );

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

        console.error(
            "Erreur de déconnexion :",
            error
        );

        throw error;

    }

}


// ==============================
// ATTENDRE L'ÉTAT DE CONNEXION
// ==============================

export function waitForAuth() {

    return new Promise(resolve => {

        const unsubscribe =
            onAuthStateChanged(
                auth,
                user => {

                    unsubscribe();

                    resolve(user);

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
// CHARGER LES DECKS DE FIRESTORE
// ==============================

export async function loadCloudDecks() {

    const user =
        auth.currentUser;


    if (!user) {

        return null;

    }


    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    const snapshot =
        await getDoc(userRef);


    if (!snapshot.exists()) {

        return null;

    }


    const data =
        snapshot.data();


    if (!Array.isArray(data.decks)) {

        return [];

    }


    return data.decks;

}


// ==============================
// SAUVEGARDER LES DECKS
// ==============================

export async function saveDecksToCloud(
    decks
) {

    const user =
        auth.currentUser;


    if (!user) {

        return;

    }


    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    await setDoc(
        userRef,
        {
            decks: decks,
            updatedAt: serverTimestamp()
        },
        {
            merge: true
        }
    );

}


// ==============================
// SYNCHRONISATION INITIALE
// ==============================

export async function syncLocalDecksWithCloud() {

    const user =
        await waitForAuth();


    /*
     * Si personne n'est connecté,
     * on laisse simplement l'application
     * fonctionner avec localStorage.
     */

    if (!user) {

        window.cloudSyncReady = true;

        return;

    }


    console.log(
        "Synchronisation avec Firestore..."
    );


    /*
     * On sauvegarde une copie locale avant
     * toute modification éventuelle.
     */

    const localDecks =
        localStorage.getItem("decks");


    if (localDecks) {

        localStorage.setItem(
            "decks_backup_before_cloud_sync",
            localDecks
        );

    }


    try {

        const cloudDecks =
            await loadCloudDecks();


        /*
         * CAS 1 :
         *
         * Firestore possède déjà des decks.
         *
         * On utilise alors les données cloud
         * comme source principale.
         */

        if (cloudDecks !== null) {

            localStorage.setItem(
                "decks",
                JSON.stringify(cloudDecks)
            );


            console.log(
                "Decks chargés depuis Firestore."
            );

        }


        /*
         * CAS 2 :
         *
         * Aucun document Firestore n'existe encore.
         *
         * On envoie les données locales.
         */

        else {

            let decksToUpload = [];


            if (localDecks) {

                try {

                    decksToUpload =
                        JSON.parse(localDecks);

                } catch (error) {

                    console.error(
                        "Impossible de lire les decks locaux :",
                        error
                    );

                }

            }


            await saveDecksToCloud(
                decksToUpload
            );


            console.log(
                "Decks locaux envoyés vers Firestore."
            );

        }


        window.cloudSyncReady = true;


        console.log(
            "Synchronisation terminée."
        );


    } catch (error) {

        console.error(
            "Erreur pendant la synchronisation Firestore :",
            error
        );


        /*
         * En cas de problème avec Firestore,
         * on ne bloque pas l'application.
         *
         * Les données locales restent utilisables.
         */

        window.cloudSyncReady = true;

    }

}


// ==============================
// SAUVEGARDE CLOUD ACCESSIBLE
// DEPUIS LES AUTRES SCRIPTS
// ==============================

window.saveDecksToCloud =
    saveDecksToCloud;