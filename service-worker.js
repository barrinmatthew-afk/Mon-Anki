
const CACHE_NAME = "mon-anki-v33";

const APP_FILES = [
    "./",
    "./index.html",
    "./edit-card.html",
    "./preview.html",
    "./settings.html",
    "./deck.html",
    "./import.html",
    "./study-time.html",
    "./JS/study-time.js",
    "./flashcards.html",
    "./study.html",
    "./JS/flashcards.js",
    "./JS/study.js",
    "./JS/deck.js",
    "./JS/firebase.js",
    "./JS/script.js"
];

// Installation : mettre en cache les fichiers disponibles.
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            await Promise.allSettled(
                APP_FILES.map(async file => {
                    try {
                        const response = await fetch(file);

                        if (response.ok) {
                            await cache.put(file, response);
                        }
                    } catch (error) {
                        console.warn(
                            "Fichier non mis en cache :",
                            file
                        );
                    }
                })
            );

            return self.skipWaiting();
        })
    );
});

// Activation : supprimer les anciennes versions du cache.
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(async keys => {
            await Promise.all(
                keys
                    .filter(key => key.startsWith("mon-anki-"))
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );

            await self.clients.claim();
        })
    );
});

// Réseau en priorité, cache en secours.
self.addEventListener("fetch", event => {
    const request = event.request;

    if (
        request.method !== "GET" ||
        new URL(request.url).origin !== self.location.origin
    ) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, copy);
                    });
                }

                return response;
            })
            .catch(async () => {
                const cached = await caches.match(request);

                if (cached) {
                    return cached;
                }

                if (request.mode === "navigate") {
                    return (
                        await caches.match("./index.html")
                    ) || Response.error();
                }

                return Response.error();
            })
    );
});
