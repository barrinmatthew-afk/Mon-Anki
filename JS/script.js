const DEFAULT_DECKS = [
    {
        name: "Néerlandais",
        cards: [
            {
                word: "arbeidsmarkt",
                answer: "marché du travail",
                level: 0,
                interval: 1,
                nextReview: 0
            },
            {
                word: "omhoog",
                answer: "vers le haut",
                level: 0,
                interval: 1,
                nextReview: 0
            },
            {
                word: "vergelijking",
                answer: "comparaison",
                level: 0,
                interval: 1,
                nextReview: 0
            }
        ]
    }
];


/* =========================
   STORAGE
========================= */

function loadDecks() {

    const saved =
        localStorage.getItem("decks");


    if (!saved) {

        localStorage.setItem(
            "decks",
            JSON.stringify(DEFAULT_DECKS)
        );


        /*
         * Si Firebase est disponible,
         * on envoie également les decks par défaut
         * dans Firestore.
         */

        if (window.saveDecksToCloud) {

            window.saveDecksToCloud(
                DEFAULT_DECKS
            ).catch(error => {

                console.error(
                    "Impossible de sauvegarder les decks par défaut dans Firestore :",
                    error
                );

            });

        }


        return DEFAULT_DECKS;

    }


    try {

        return JSON.parse(saved);

    } catch (error) {

        console.error(
            "Impossible de charger les decks :",
            error
        );

        return [];

    }

}


function saveDecks(decks) {

    /*
     * Sauvegarde locale.
     */

    localStorage.setItem(
        "decks",
        JSON.stringify(decks)
    );


    /*
     * Sauvegarde Firestore.
     */

    if (window.saveDecksToCloud) {

        window.saveDecksToCloud(
            decks
        ).catch(error => {

            console.error(
                "Impossible de sauvegarder les decks dans Firestore :",
                error
            );

        });

    }

}


/* =========================
   DATE / REVIEWS
========================= */

function isCardDue(card) {

    return !card.nextReview ||
        card.nextReview <= Date.now();

}


function getDueCards(deck) {

    return deck.cards.filter(
        card => isCardDue(card)
    );

}


/* =========================
   AFFICHAGE DES DECKS
========================= */

function renderDeckElement(
    deck,
    index,
    displayName
) {

    const dueCards =
        getDueCards(deck);

    const dueCount =
        dueCards.length;


    const deckElement =
        document.createElement("div");


    deckElement.className =
        "deck";


    const dueText =
        dueCount === 0
            ? `<div class="due-count nothing-due">✓ Rien à réviser</div>`
            : `<div class="due-count">${dueCount} carte${dueCount > 1 ? "s" : ""} à réviser</div>`;


    deckElement.innerHTML = `

        <div class="deck-header">

            <div>

                <div class="deck-name">
                    ${escapeHTML(displayName)}
                </div>

                <div class="deck-info">
                    ${deck.cards.length} carte${deck.cards.length > 1 ? "s" : ""}
                </div>

                ${dueText}

            </div>


            <div class="deck-actions">

                <button
                    class="study-button"
                    data-index="${index}"
                    ${dueCount === 0 ? "disabled" : ""}
                >
                    Étudier
                </button>


                <button
                    class="manage-button"
                    data-index="${index}"
                >
                    Gérer
                </button>


                <button
                    class="delete-button"
                    data-index="${index}"
                >
                    Supprimer
                </button>

            </div>

        </div>

    `;


    return deckElement;

}


function groupDecksByPrefix(decks) {

    const groups =
        new Map();


    decks.forEach(
        (deck, index) => {

            const parts =
                deck.name.split("::");


            const topName =
                parts[0];


            if (!groups.has(topName)) {

                groups.set(
                    topName,
                    []
                );

            }


            groups.get(topName).push({

                deck,
                index,
                isSub: parts.length > 1,
                subLabel:
                    parts.slice(1).join("::")

            });

        }
    );


    return groups;

}


function displayDecks() {

    const container =
        document.getElementById(
            "decks-container"
        );


    container.innerHTML = "";


    const decks =
        loadDecks();


    if (decks.length === 0) {

        container.innerHTML = `

            <p class="empty">
                Aucun deck pour le moment.
            </p>

        `;

        return;

    }


    const groups =
        groupDecksByPrefix(decks);


    groups.forEach(
        (entries, groupName) => {

            if (
                entries.length === 1 &&
                !entries[0].isSub
            ) {

                /*
                 * Deck isolé, sans sous-deck :
                 * on l'affiche comme avant.
                 */

                const {
                    deck,
                    index
                } = entries[0];


                container.appendChild(

                    renderDeckElement(
                        deck,
                        index,
                        deck.name
                    )

                );


                return;

            }


            /*
             * Un ou plusieurs sous-decks
             * partagent ce préfixe.
             */

            const groupTotalDue =
                entries.reduce(
                    (total, entry) =>
                        total +
                        getDueCards(entry.deck).length,
                    0
                );


            const groupElement =
                document.createElement("div");


            groupElement.className =
                "deck-group";


            groupElement.innerHTML = `

                <div class="deck-group-header">

                    <div class="deck-group-name">
                        ${escapeHTML(groupName)}
                    </div>

                    <div class="deck-group-due">

                        ${
                            groupTotalDue === 0
                                ? "✓ Rien à réviser"
                                : `${groupTotalDue} carte${groupTotalDue > 1 ? "s" : ""} à réviser au total`
                        }

                    </div>

                </div>

            `;


            entries.forEach(
                entry => {

                    const displayName =
                        entry.isSub
                            ? entry.subLabel
                            : entry.deck.name;


                    groupElement.appendChild(

                        renderDeckElement(
                            entry.deck,
                            entry.index,
                            displayName
                        )

                    );

                }
            );


            container.appendChild(
                groupElement
            );

        }
    );


    /* =========================
       BOUTONS ÉTUDIER
    ========================= */

    document
        .querySelectorAll(".study-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    const decks =
                        loadDecks();


                    localStorage.setItem(
                        "selectedDeck",
                        decks[index].name
                    );


                    window.location.href =
                        "study.html";

                }
            );

        });


    /* =========================
       BOUTONS GÉRER
    ========================= */

    document
        .querySelectorAll(".manage-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    const decks =
                        loadDecks();


                    localStorage.setItem(
                        "manageDeckName",
                        decks[index].name
                    );


                    window.location.href =
                        "deck.html";

                }
            );

        });


    /* =========================
       BOUTONS SUPPRIMER
    ========================= */

    document
        .querySelectorAll(".delete-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    const decks =
                        loadDecks();


                    const deckName =
                        decks[index].name;


                    const confirmation =
                        confirm(
                            `Supprimer le deck "${deckName}" ?`
                        );


                    if (!confirmation) {

                        return;

                    }


                    decks.splice(
                        index,
                        1
                    );


                    saveDecks(
                        decks
                    );


                    displayDecks();

                    displayForecast();

                }
            );

        });

}


/* =========================
   CREATION DE DECK
========================= */

function createDeck() {

    const input =
        document.getElementById(
            "new-deck-name"
        );


    const name =
        input.value.trim();


    if (!name) {

        alert(
            "Entre un nom de deck."
        );

        return;

    }


    const decks =
        loadDecks();


    const alreadyExists =
        decks.some(
            deck =>
                deck.name.toLowerCase() ===
                name.toLowerCase()
        );


    if (alreadyExists) {

        alert(
            "Ce deck existe déjà."
        );

        return;

    }


    decks.push({

        name: name,

        cards: []

    });


    saveDecks(
        decks
    );


    input.value = "";


    displayDecks();

    displayForecast();

}


/* =========================
   FORECAST
========================= */

function getForecast() {

    const decks =
        loadDecks();


    const now =
        Date.now();


    const hour =
        60 * 60 * 1000;


    const forecast = [];


    /*
     * On regarde les 24 prochaines heures.
     */

    for (
        let i = 0;
        i < 24;
        i++
    ) {

        const start =
            now + i * hour;


        const end =
            start + hour;


        let count = 0;


        decks.forEach(
            deck => {

                deck.cards.forEach(
                    card => {

                        if (!card.nextReview) {

                            return;

                        }


                        /*
                         * Une carte déjà due maintenant
                         * n'est pas comptée dans le futur.
                         */

                        if (
                            card.nextReview > start &&
                            card.nextReview <= end
                        ) {

                            count++;

                        }

                    }
                );

            }
        );


        forecast.push({

            start,
            end,
            count

        });

    }


    return forecast;

}


function displayForecast() {

    const chart =
        document.getElementById(
            "forecast-chart"
        );


    if (!chart) {

        return;

    }


    const forecast =
        getForecast();


    /*
     * On regarde aussi s'il y a réellement
     * quelque chose à afficher.
     */

    const hasFutureCards =
        forecast.some(
            item =>
                item.count > 0
        );


    if (!hasFutureCards) {

        chart.innerHTML = `

            <div class="forecast-empty">

                Aucune carte prévue dans les
                prochaines 24 heures.

            </div>

        `;

        return;

    }


    const max =
        Math.max(
            ...forecast.map(
                item => item.count
            ),
            1
        );


    chart.innerHTML = "";


    forecast.forEach(
        item => {

            const date =
                new Date(
                    item.start
                );


            const hourText =
                date.toLocaleTimeString(
                    "fr-BE",
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );


            const column =
                document.createElement(
                    "div"
                );


            column.className =
                "forecast-column";


            const number =
                document.createElement(
                    "div"
                );


            number.className =
                "forecast-number";


            number.textContent =
                item.count > 0
                    ? item.count
                    : "";


            const barContainer =
                document.createElement(
                    "div"
                );


            barContainer.className =
                "forecast-bar-container";


            const bar =
                document.createElement(
                    "div"
                );


            bar.className =
                "forecast-bar";


            const height =
                item.count === 0
                    ? 2
                    : Math.max(
                        5,
                        (item.count / max) * 100
                    );


            bar.style.height =
                `${height}%`;


            const hour =
                document.createElement(
                    "div"
                );


            hour.className =
                "forecast-hour";


            hour.textContent =
                hourText;


            barContainer.appendChild(
                bar
            );


            column.appendChild(
                number
            );


            column.appendChild(
                barContainer
            );


            column.appendChild(
                hour
            );


            chart.appendChild(
                column
            );

        }
    );

}


/* =========================
   SECURITE HTML
========================= */

function escapeHTML(text) {

    return text
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================
   SAUVEGARDE MANUELLE
========================= */

function exportDecks() {

    const decks =
        loadDecks();


    const blob =
        new Blob(
            [
                JSON.stringify(
                    decks,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    const date =
        new Date()
            .toISOString()
            .slice(0, 10);


    link.download =
        `mon-anki-sauvegarde-${date}.json`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );

}


function mergeImportedDecks(
    importedDecks,
    existingDecks
) {

    let addedDecks = 0;

    let addedCards = 0;


    importedDecks.forEach(
        importedDeck => {

            const existingDeck =
                existingDecks.find(
                    deck =>
                        deck.name ===
                        importedDeck.name
                );


            if (!existingDeck) {

                existingDecks.push(
                    importedDeck
                );


                addedDecks++;


                addedCards +=
                    importedDeck.cards.length;


                return;

            }


            importedDeck.cards.forEach(
                importedCard => {

                    const alreadyExists =
                        existingDeck.cards.some(
                            card =>
                                card.word ===
                                    importedCard.word &&

                                card.answer ===
                                    importedCard.answer &&

                                card.mode ===
                                    importedCard.mode
                        );


                    if (!alreadyExists) {

                        existingDeck.cards.push(
                            importedCard
                        );


                        addedCards++;

                    }

                }
            );

        }
    );


    return {

        addedDecks,

        addedCards

    };

}


function importDecksFromFile(file) {

    const statusElement =
        document.getElementById(
            "sync-status"
        );


    const reader =
        new FileReader();


    reader.onload = () => {

        let importedDecks;


        try {

            importedDecks =
                JSON.parse(
                    reader.result
                );

        } catch (error) {

            console.error(
                error
            );


            if (statusElement) {

                statusElement.textContent =
                    "Ce fichier n'est pas une sauvegarde valide.";

            }


            return;

        }


        if (!Array.isArray(
            importedDecks
        )) {

            if (statusElement) {

                statusElement.textContent =
                    "Ce fichier n'est pas une sauvegarde valide.";

            }


            return;

        }


        const existingDecks =
            loadDecks();


        const result =
            mergeImportedDecks(
                importedDecks,
                existingDecks
            );


        saveDecks(
            existingDecks
        );


        displayDecks();

        displayForecast();


        if (statusElement) {

            statusElement.textContent =
                `Importé : ${result.addedDecks} nouveau(x) deck(s), ${result.addedCards} nouvelle(s) carte(s).`;

        }

    };


    reader.readAsText(
        file
    );

}


/* =========================
   INITIALISATION
========================= */

/*
 * IMPORTANT :
 *
 * script.js est maintenant chargé avec
 * import("./JS/script.js") après la synchronisation
 * Firebase.
 *
 * À ce moment-là, DOMContentLoaded est déjà passé.
 * Il ne faut donc plus attendre cet événement.
 */

const createButton =
    document.getElementById(
        "create-deck"
    );


if (createButton) {

    createButton.addEventListener(
        "click",
        createDeck
    );

}


const input =
    document.getElementById(
        "new-deck-name"
    );


if (input) {

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                createDeck();

            }

        }
    );

}


const exportButton =
    document.getElementById(
        "export-button"
    );


if (exportButton) {

    exportButton.addEventListener(
        "click",
        exportDecks
    );

}


const importTriggerButton =
    document.getElementById(
        "import-trigger-button"
    );


const importFileInput =
    document.getElementById(
        "import-file-input"
    );


if (
    importTriggerButton &&
    importFileInput
) {

    importTriggerButton.addEventListener(
        "click",
        () =>
            importFileInput.click()
    );


    importFileInput.addEventListener(
        "change",
        () => {

            const file =
                importFileInput.files[0];


            if (file) {

                importDecksFromFile(
                    file
                );

            }


            importFileInput.value =
                "";

        }
    );

}


/*
 * On initialise l'affichage immédiatement,
 * puisque le DOM existe déjà lorsque ce fichier
 * est importé.
 */

displayDecks();

displayForecast();