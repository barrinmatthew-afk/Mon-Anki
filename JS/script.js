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
    localStorage.setItem(
        "decks",
        JSON.stringify(decks)
    );

    // Prévenir l'interface que les données locales ont changé.
    window.dispatchEvent(
        new CustomEvent("decksUpdated", {
            detail: { source: "local" }
        })
    );

    if (typeof window.saveDecksToCloud === "function") {
        try {
            Promise.resolve(
                window.saveDecksToCloud(decks)
            ).catch(error => {
                console.error(
                    "Impossible de sauvegarder les decks dans Firestore :",
                    error
                );
            });
        } catch (error) {
            console.error(
                "Erreur lors de la sauvegarde cloud :",
                error
            );
        }
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
    // Seuls les decks principaux ont tout le contour coloré.
    if (!deck.name.includes("::")) {
        deckElement.style.border = `2px solid ${getDeckColor(deck)}`;
    }


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



function buildDeckTree(decks) {
    const root = {
        label: "",
        children: new Map(),
        entry: null
    };

    decks.forEach((deck, index) => {
        const parts = deck.name.split("::");
        let node = root;

        parts.forEach((part, partIndex) => {
            if (!node.children.has(part)) {
                node.children.set(part, {
                    label: part,
                    children: new Map(),
                    entry: null
                });
            }

            node = node.children.get(part);

            // Le deck réel peut exister à n'importe quel niveau.
            if (partIndex === parts.length - 1) {
                node.entry = { deck, index };
            }
        });
    });

    return root;
}


function countDueInTree(node) {
    let total = node.entry
        ? getDueCards(node.entry.deck).length
        : 0;

    node.children.forEach(child => {
        total += countDueInTree(child);
    });

    return total;
}


function renderDeckTreeNode(node, isRootGroup = true) {
    // Un deck sans sous-deck garde son affichage habituel.
    if (node.children.size === 0 && node.entry) {
        return renderDeckElement(
            node.entry.deck,
            node.entry.index,
            node.label
        );
    }

    const groupElement = document.createElement("div");
    groupElement.className = "deck-group";

    // La couleur du deck parent colore l'intérieur du groupe (ex. Droit),
    // pas les cartes de ses sous-decks (ex. CM1, CM2).
    if (isRootGroup) {
        const groupColor = getDeckColor(node.label);
        groupElement.style.border = `2px solid ${groupColor}`;
        groupElement.style.backgroundColor = `${groupColor}18`;
    }

    const header = document.createElement("div");
    header.className = "deck-group-header";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "deck-group-toggle";
    // Les groupes restent fermés à l'ouverture de l'application.
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Ouvrir le groupe " + node.label);

    const dueCount = countDueInTree(node);

    const dueText = dueCount === 0
        ? "✓ Rien à réviser"
        : `${dueCount} carte${dueCount > 1 ? "s" : ""} à réviser au total`;

    toggle.innerHTML = `
        <span class="deck-group-name">
            ${escapeHTML(node.label)}
        </span>
        <span class="deck-group-right">
            <span class="deck-group-due">
                ${dueText}
            </span>
            <span class="deck-group-arrow">▶</span>
        </span>
    `;

    const content = document.createElement("div");
    content.className = "deck-group-content";
    content.hidden = true;

    // Si ce niveau correspond aussi à un deck réel,
    // on affiche ce deck avant ses sous-decks.
    if (node.entry) {
        content.appendChild(
            renderDeckElement(
                node.entry.deck,
                node.entry.index,
                node.label
            )
        );
    }

    node.children.forEach(child => {
        content.appendChild(
            renderDeckTreeNode(child, false)
        );
    });

    toggle.addEventListener("click", () => {
        const isExpanded =
            toggle.getAttribute("aria-expanded") === "true";

        toggle.setAttribute(
            "aria-expanded",
            String(!isExpanded)
        );
        toggle.setAttribute(
            "aria-label",
            (isExpanded ? "Ouvrir le groupe " : "Fermer le groupe ") + node.label
        );

        content.hidden = isExpanded;

        const arrow =
            toggle.querySelector(".deck-group-arrow");

        arrow.textContent = isExpanded ? "▶" : "▼";
    });

    header.appendChild(toggle);
    groupElement.appendChild(header);
    groupElement.appendChild(content);

    return groupElement;
}




function displayDecks() {

    const container =
        document.getElementById("decks-container");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const decks = loadDecks();

    if (decks.length === 0) {
        container.innerHTML = `
            <p class="empty">
                Aucun deck pour le moment.
            </p>
        `;
        return;
    }

    // Construire et afficher l'arborescence des decks.
    const tree = buildDeckTree(decks);

    tree.children.forEach(node => {
        container.appendChild(
            renderDeckTreeNode(node)
        );
    });

    /* =========================
       COULEURS PERSONNALISÉES DES DECKS
    ========================= */
    container
        .querySelectorAll(".deck-color-picker")
        .forEach(input => {
            input.addEventListener("input", () => {
                const index = Number(input.dataset.index);
                const decks = loadDecks();
                if (!decks[index]) return;

                decks[index].color = input.value;
                saveDecks(decks);
                // Met à jour uniquement la timeline : ne ferme pas les groupes ouverts.
                displayForecast();
            });
        });

    /* =========================
       BOUTONS ÉTUDIER
    ========================= */

    container
        .querySelectorAll(".study-button")
        .forEach(button => {

            button.addEventListener("click", () => {

                const index =
                    Number(button.dataset.index);

                const decks = loadDecks();

                localStorage.setItem(
                    "selectedDeck",
                    decks[index].name
                );

                window.location.href = "study.html";
            });

        });

    /* =========================
       BOUTONS GÉRER
    ========================= */

    container
        .querySelectorAll(".manage-button")
        .forEach(button => {

            button.addEventListener("click", () => {

                const index =
                    Number(button.dataset.index);

                const decks = loadDecks();

                localStorage.setItem(
                    "manageDeckName",
                    decks[index].name
                );

                window.location.href = "deck.html";
            });

        });

    /* =========================
       BOUTONS SUPPRIMER
    ========================= */

    container
        .querySelectorAll(".delete-button")
        .forEach(button => {

            button.addEventListener("click", () => {

                const decks = loadDecks();
                const index = Number(button.dataset.index);

                if (!Number.isInteger(index) || index < 0 || !decks[index]) {
                    alert("Impossible de retrouver ce deck. Actualise la page puis réessaie.");
                    return;
                }

                const deckName = decks[index].name;
                const childDecks = decks.filter(item =>
                    item.name.startsWith(deckName + "::")
                );

                const message = childDecks.length
                    ? `Supprimer "${deckName}" et ses ${childDecks.length} sous-deck(s) ?`
                    : `Supprimer le deck "${deckName}" ?`;

                if (!confirm(message)) return;

                // Supprime le deck sélectionné et ses éventuels sous-decks
                // afin qu'un groupe parent ne réapparaisse pas aussitôt.
                const namesToDelete = new Set([
                    deckName,
                    ...childDecks.map(item => item.name)
                ]);
                const remainingDecks = decks.filter(item => !namesToDelete.has(item.name));

                saveDecks(remainingDecks);
                displayDecks();
                displayForecast();

            });

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

function getDeckColor(deckOrName) {
    const decks = loadDecks();
    const name = typeof deckOrName === "object" ? deckOrName.name : String(deckOrName || "");
    const rootName = name.split("::")[0];
    const rootDeck = decks.find(deck => deck.name === rootName);
    if (rootDeck && /^#[0-9a-f]{6}$/i.test(rootDeck.color || "")) {
        return rootDeck.color;
    }

    const palette = ["#2563eb", "#0f766e", "#c2410c", "#7c3aed", "#be185d", "#4d7c0f", "#0369a1", "#a16207", "#475569", "#0e7490", "#9333ea", "#b91c1c"];
    let hash = 0;
    for (const char of rootName) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
}


function getForecast() {
    const decks = loadDecks();
    const now = Date.now();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const forecast = [];

    // Prévision glissante sur 24 heures, y compris demain à la même heure.
    // Chaque carte est placée selon son échéance SRS réelle (nextReview).
    for (let offset = 0; offset < 24; offset++) {
        const startDate = new Date(currentHour.getTime() + offset * 60 * 60 * 1000);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        const start = startDate.getTime();
        const end = endDate.getTime();
        const deckCounts = [];
        decks.forEach(deck => {
            const cards = Array.isArray(deck.cards) ? deck.cards : [];
            const count = cards.filter(card => {
                const reviewTime = Number(card.nextReview);
                return Number.isFinite(reviewTime) && reviewTime > now && reviewTime >= start && reviewTime < end;
            }).length;
            if (count > 0) deckCounts.push({ name: deck.name, count, color: getDeckColor(deck) });
        });
        forecast.push({ start, end, deckCounts, count: deckCounts.reduce((sum, item) => sum + item.count, 0) });
    }
    return forecast;
}

function displayForecast() {
    const chart = document.getElementById("forecast-chart");
    if (!chart) return;

    const forecast = getForecast();
    const decks = loadDecks();

    chart.innerHTML = "";
    if (!forecast.some(item => item.count > 0)) {
        chart.innerHTML = '<div class="forecast-empty">Aucune révision programmée dans les 24 prochaines heures.</div>';
    }

    const max = Math.max(...forecast.map(item => item.count), 1);

    forecast.forEach(item => {
        const date = new Date(item.start);
        const column = document.createElement("div");
        column.className = "forecast-column";

        const number = document.createElement("div");
        number.className = "forecast-number";
        number.textContent = item.count > 0 ? String(item.count) : "";

        const barContainer = document.createElement("div");
        barContainer.className = "forecast-bar-container";
        const bar = document.createElement("div");
        bar.className = "forecast-bar";
        bar.style.height = item.count === 0 ? "2%" : `${Math.max(5, (item.count / max) * 100)}%`;

        item.deckCounts.forEach(deck => {
            const segment = document.createElement("div");
            segment.className = "forecast-segment";
            segment.style.height = `${(deck.count / item.count) * 100}%`;
            segment.style.backgroundColor = deck.color;
            bar.appendChild(segment);
        });

        const hour = document.createElement("div");
        hour.className = "forecast-hour";
        const timeLabel = date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
                const today = new Date();
                const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();
                hour.textContent = isToday ? timeLabel : (isTomorrow ? "Demain " : date.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" }) + " ") + timeLabel;

        const detail = item.deckCounts.length
            ? item.deckCounts.map(deck => `${deck.name}: ${deck.count} carte${deck.count > 1 ? "s" : ""}`).join("\\n")
            : "Aucune carte prévue";
        column.title = `${hour.textContent} — ${item.count} carte${item.count > 1 ? "s" : ""}\\n${detail}`;
        column.setAttribute("aria-label", column.title);
        column.tabIndex = 0;

        barContainer.appendChild(bar);
        column.append(number, barContainer, hour);
        chart.appendChild(column);
    });
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



/*
 * Exporte uniquement le contenu des decks, sans la progression SRS.
 * Les champs inconnus sont conservés afin de ne pas perdre de métadonnées
 * utiles au contenu des cartes.
 */
function exportDecksWithoutProgress() {

    const decks =
        loadDecks();

    const progressFields = new Set([
        "state",
        "step",
        "interval",
        "nextReview",
        "reps",
        "level"
    ]);

    const contentOnlyDecks =
        decks.map(deck => ({
            ...deck,
            cards: (Array.isArray(deck.cards) ? deck.cards : []).map(card => {
                const contentCard = { ...card };

                progressFields.forEach(field => {
                    delete contentCard[field];
                });

                return contentCard;
            })
        }));

    const blob =
        new Blob(
            [
                JSON.stringify(
                    contentOnlyDecks,
                    null,
                    2
                )
            ],
            {
                type: "application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    const date =
        new Date()
            .toISOString()
            .slice(0, 10);

    link.download =
        `mon-anki-decks-sans-progression-${date}.json`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    // Laisse au navigateur le temps de commencer le téléchargement.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

export function initializeApp() {

    console.log(
        "Mon Anki : initialisation..."
    );


    /* =========================
       BOUTON CREER
    ========================= */

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


    /* =========================
       CHAMP NOM DECK
    ========================= */

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


    /* =========================
       EXPORT
    ========================= */

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

    const exportContentButton =
        document.getElementById(
            "export-content-button"
        );

    if (exportContentButton) {

        exportContentButton.addEventListener(
            "click",
            exportDecksWithoutProgress
        );

    }


    /* =========================
       IMPORT
    ========================= */

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


    /* =========================
       AFFICHAGE INITIAL
    ========================= */

    displayDecks();

    displayForecast();


    console.log(
        "Mon Anki : initialisation terminée."
    );

}

// L'affichage n'est plus reconstruit automatiquement à chaque petite
// mise à jour de synchronisation : cela refermait les groupes pendant
// que l'utilisateur naviguait. Les actions explicites (création,
// suppression, importation et bouton de synchronisation) rafraîchissent
// l'interface au moment voulu.