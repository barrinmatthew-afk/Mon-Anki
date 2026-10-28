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
    // Les decks principaux affichent leur couleur et un sélecteur.
    if (!deck.name.includes("::")) {
        const deckColor = getDeckColor(deck);
        deckElement.style.border = `2px solid ${deckColor}`;
        deckElement.style.backgroundColor = `${deckColor}12`;
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

                ${!deck.name.includes("::") ? `<label class="deck-color-label" title="Modifier la couleur de ce deck">
                    <span>Couleur</span>
                    <input class="deck-color-picker" type="color" data-root-name="${escapeHTML(deck.name)}" value="${getDeckColor(deck)}" aria-label="Couleur du deck ${escapeHTML(deck.name)}">
                </label>` : ""}

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

    // Sélecteur de couleur directement sur le groupe parent (ex. Droit).
    const colorLabel = document.createElement("label");
    colorLabel.className = "deck-color-label group-color-label";
    colorLabel.title = "Modifier la couleur du groupe " + node.label;
    colorLabel.innerHTML = `<span>Couleur</span><input class="deck-color-picker" type="color" data-root-name="${escapeHTML(node.label)}" aria-label="Couleur du groupe ${escapeHTML(node.label)}">`;
    const groupColorInput = colorLabel.querySelector("input");
    groupColorInput.value = getDeckColor(node.label);
    header.appendChild(colorLabel);

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
                const rootName = input.dataset.rootName;
                if (!rootName) return;

                // La couleur est associée au nom du deck/groupe parent,
                // même si celui-ci n'est pas lui-même un deck avec des cartes.
                const colors = JSON.parse(localStorage.getItem("deckColors") || "{}");
                colors[rootName] = input.value;
                localStorage.setItem("deckColors", JSON.stringify(colors));

                // Garder aussi la propriété color du deck racine si elle existe,
                // pour conserver la compatibilité avec les anciennes données.
                const decks = loadDecks();
                const rootDeck = decks.find(deck => deck.name === rootName);
                if (rootDeck) {
                    rootDeck.color = input.value;
                    saveDecks(decks);
                }

                const group = input.closest(".deck-group");
                if (group) {
                    group.style.border = `2px solid ${input.value}`;
                    group.style.backgroundColor = `${input.value}18`;
                }
                const deckCard = input.closest(".deck");
                if (deckCard) {
                    deckCard.style.border = `2px solid ${input.value}`;
                    deckCard.style.backgroundColor = `${input.value}12`;
                }
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

                // Garder une trace des suppressions pour empêcher leur résurrection au prochain sync.
                try {
                    const deleted = JSON.parse(localStorage.getItem("monanki_deleted_deck_names") || "[]");
                    localStorage.setItem("monanki_deleted_deck_names", JSON.stringify([...new Set([...deleted, ...namesToDelete])]));
                } catch (error) { console.warn("Impossible d'enregistrer la suppression cloud du deck.", error); }

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
    const colors = JSON.parse(localStorage.getItem("deckColors") || "{}");
    if (/^#[0-9a-f]{6}$/i.test(colors[rootName] || "")) {
        return colors[rootName];
    }
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

    let forecast;
    try {
        forecast = getForecast();
    } catch (error) {
        console.error("Impossible de calculer les prochaines révisions :", error);
        const totalElement = document.getElementById("forecast-total");
        if (totalElement) totalElement.textContent = "Impossible de calculer le total. Actualise la page.";
        chart.textContent = "Erreur lors du calcul de la timeline.";
        return;
    }
    const totalNext24Hours = forecast.reduce((sum, item) => sum + item.count, 0);
    const totalElement = document.getElementById("forecast-total");
    if (totalElement) {
        totalElement.textContent = totalNext24Hours + " carte" + (totalNext24Hours > 1 ? "s" : "") + " prévues dans les prochaines 24 h";
    }

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
        // Afficher uniquement l'heure : pas de libellé « Demain » qui élargit la timeline.
        const timeLabel = date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
        hour.textContent = timeLabel;

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
       ONGLETS INTERNES + EDITEUR DE CARTE
    ========================= */
    const homeInternalTab = document.querySelector('[data-internal-tab="home"]');
    const cardInternalTabs = document.getElementById("card-internal-tabs");
    const internalEditor = document.getElementById("internal-card-editor");
    const openCardTabs = [];
    let activeInternalTabId = "home";
    let nextInternalTabId = 1;

    function getCardTabLabel(card, index) {
        const label = [card.word, card.question, card.front, card.expression]
            .find(value => typeof value === "string" && value.trim());
        return String(label || "Carte " + (index + 1)).slice(0, 22);
    }

    function setActiveInternalTab(tabId) {
        activeInternalTabId = tabId;
        const isHome = tabId === "home";
        document.body.classList.toggle("card-editor-active", !isHome);
        homeInternalTab?.classList.toggle("active", isHome);
        cardInternalTabs?.querySelectorAll("[data-card-tab-id]").forEach(button => {
            button.classList.toggle("active", button.dataset.cardTabId === tabId);
        });
        internalEditor.hidden = isHome;
        if (isHome) {
            internalEditor.replaceChildren();
        } else {
            renderInternalCardEditor();
        }
    }

    function renderInternalTabs() {
        if (!cardInternalTabs) return;
        cardInternalTabs.replaceChildren();
        openCardTabs.forEach(tab => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "internal-tab" + (tab.id === activeInternalTabId ? " active" : "");
            button.dataset.cardTabId = tab.id;
            const title = document.createElement("span");
            const found = loadDecks().find(deck => deck.name === tab.deckName);
            const card = found?.cards?.[tab.index];
            title.textContent = card ? getCardTabLabel(card, tab.index) : "Carte introuvable";
            button.appendChild(title);
            const close = document.createElement("span");
            close.className = "internal-tab-close";
            close.textContent = "×";
            close.setAttribute("aria-label", "Fermer cet onglet");
            close.addEventListener("click", event => {
                event.stopPropagation();
                const wasActive = activeInternalTabId === tab.id;
                const position = openCardTabs.findIndex(item => item.id === tab.id);
                openCardTabs.splice(position, 1);
                if (wasActive) setActiveInternalTab(openCardTabs[position - 1]?.id || openCardTabs[0]?.id || "home");
                renderInternalTabs();
            });
            button.appendChild(close);
            button.addEventListener("click", () => setActiveInternalTab(tab.id));
            cardInternalTabs.appendChild(button);
        });
        homeInternalTab?.classList.toggle("active", activeInternalTabId === "home");
    }

    function openInternalCardTab(deckName, index) {
        const existing = openCardTabs.find(tab => tab.deckName === deckName && tab.index === index);
        if (existing) {
            setActiveInternalTab(existing.id);
            renderInternalTabs();
            return;
        }
        const tab = { id: "card-" + nextInternalTabId++, deckName, index };
        openCardTabs.push(tab);
        setActiveInternalTab(tab.id);
        renderInternalTabs();
    }

    function renderInternalCardEditor() {
        if (!internalEditor || activeInternalTabId === "home") return;
        const tab = openCardTabs.find(item => item.id === activeInternalTabId);
        if (!tab) return;
        const decks = loadDecks();
        const sourceDeck = decks.find(deck => deck.name === tab.deckName);
        const card = sourceDeck?.cards?.[tab.index];
        internalEditor.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = "Modifier une carte";
        internalEditor.appendChild(heading);
        if (!sourceDeck || !card) {
            const missing = document.createElement("p");
            missing.textContent = "Cette carte est introuvable. Ferme cet onglet et relance la recherche.";
            internalEditor.appendChild(missing);
            return;
        }

        const info = document.createElement("p");
        info.className = "card-search-editor-deck";
        info.textContent = "Deck actuel : " + sourceDeck.name + " · La progression de révision sera conservée.";
        internalEditor.appendChild(info);

        const labels = {
            word: "Mot / recto", answer: "Réponse / verso", question: "Question",
            translation: "Traduction", front: "Recto", back: "Verso",
            meaning: "Sens", expression: "Expression", example: "Exemple",
            notes: "Notes", hint: "Indice"
        };
        const editableFields = Object.keys(card).filter(key => typeof card[key] === "string");
        editableFields.forEach(key => {
            const label = document.createElement("label");
            label.className = "internal-editor-field";
            const caption = document.createElement("span");
            caption.textContent = labels[key] || key;
            const input = document.createElement("textarea");
            input.value = card[key];
            input.dataset.cardField = key;
            input.rows = input.value.length > 100 ? 4 : 2;
            label.append(caption, input);
            internalEditor.appendChild(label);
        });

        const moveLabel = document.createElement("label");
        moveLabel.className = "internal-editor-field";
        const moveCaption = document.createElement("span");
        moveCaption.textContent = "Déplacer vers un autre deck";
        const select = document.createElement("select");
        select.id = "internal-card-target-deck";
        decks.forEach(deck => {
            const option = document.createElement("option");
            option.value = deck.name;
            option.textContent = deck.name;
            option.selected = deck.name === sourceDeck.name;
            select.appendChild(option);
        });
        moveLabel.append(moveCaption, select);
        internalEditor.appendChild(moveLabel);

        const actions = document.createElement("div");
        actions.className = "internal-editor-actions";
        const save = document.createElement("button");
        save.type = "button";
        save.textContent = "Enregistrer";
        save.addEventListener("click", () => {
            const latestDecks = loadDecks();
            const latestSource = latestDecks.find(deck => deck.name === tab.deckName);
            const latestCard = latestSource?.cards?.[tab.index];
            if (!latestSource || !latestCard) {
                status.textContent = "Carte introuvable : aucune modification enregistrée.";
                return;
            }
            internalEditor.querySelectorAll("[data-card-field]").forEach(input => {
                latestCard[input.dataset.cardField] = input.value;
            });
            const targetName = select.value;
            if (targetName !== latestSource.name) {
                const targetDeck = latestDecks.find(deck => deck.name === targetName);
                if (!targetDeck) {
                    status.textContent = "Le deck de destination n'existe plus.";
                    return;
                }
                latestSource.cards.splice(tab.index, 1);
                targetDeck.cards.push(latestCard);
                tab.deckName = targetDeck.name;
                tab.index = targetDeck.cards.length - 1;
            }
            saveDecks(latestDecks);
            displayDecks();
            displayForecast();
            renderInternalTabs();
            renderInternalCardEditor();
            const savedStatus = document.createElement("p");
            savedStatus.className = "internal-editor-status";
            savedStatus.textContent = targetName !== latestSource.name
                ? "✓ Carte modifiée et déplacée vers « " + targetName + " »."
                : "✓ Modifications enregistrées.";
            internalEditor.appendChild(savedStatus);
        });
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Annuler les modifications";
        cancel.addEventListener("click", () => renderInternalCardEditor());
        actions.append(save, cancel);
        internalEditor.appendChild(actions);
    }

    homeInternalTab?.addEventListener("click", () => setActiveInternalTab("home"));

    /* =========================
       RECHERCHE GLOBALE : DECKS, CARTES ET MOTS
    ========================= */
    const cardSearchInput = document.getElementById("card-search-input");
    const cardSearchResults = document.getElementById("card-search-results");

    if (cardSearchInput && cardSearchResults) {
        const normalizeSearch = value => String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase()
            .trim();

        const makeSearchResult = (kind, titleText, detailText, onClick) => {
            const result = document.createElement("button");
            result.type = "button";
            result.className = "card-search-result";
            const kindLabel = document.createElement("span");
            kindLabel.className = "card-search-kind";
            kindLabel.textContent = kind;
            const title = document.createElement("strong");
            title.textContent = titleText;
            const detail = document.createElement("small");
            detail.textContent = detailText;
            result.append(kindLabel, title, detail);
            result.addEventListener("click", onClick);
            cardSearchResults.appendChild(result);
        };


        const dictionaryButton = document.getElementById("dictionary-search-button");
        const difficultButton = document.getElementById("difficult-cards-button");
        let showingDifficultOnly = false;

        const renderDifficultCards = () => {
            const decks = loadDecks();
            const matches = [];
            decks.forEach(deck => (Array.isArray(deck.cards) ? deck.cards : []).forEach((card, index) => {
                if (card && card.difficult === true) matches.push({ deck, card, index });
            }));
            cardSearchResults.replaceChildren();
            if (!matches.length) {
                const empty = document.createElement("p");
                empty.className = "card-search-empty";
                empty.textContent = "Aucune carte marquée comme difficile pour le moment.";
                cardSearchResults.appendChild(empty);
                return;
            }
            matches.slice(0, 50).forEach(({deck, card, index}) => {
                const title = [card.word, card.question, card.front, card.expression, card.term].find(value => typeof value === "string" && value.trim()) || "Carte " + (index + 1);
                const detail = [card.answer, card.translation, card.back, card.meaning, card.definition].find(value => typeof value === "string" && value.trim()) || "";
                makeSearchResult("⚑ Carte difficile", title, detail + " · Deck : " + deck.name, () => {
                    openInternalCardTab(deck.name, index);
                    document.getElementById("card-search-close")?.click();
                });
            });
            if (matches.length > 50) {
                const more = document.createElement("p");
                more.className = "card-search-empty";
                more.textContent = "50 cartes affichées sur " + matches.length + ".";
                cardSearchResults.appendChild(more);
            }
        };

        dictionaryButton?.addEventListener("click", () => {
            const termInput = document.getElementById("homepage-dictionary-term");
            const sourceSelect = document.getElementById("homepage-dictionary-source");
            const term = String(termInput?.value || "").trim();
            if (!term) {
                termInput?.focus();
                if (termInput) termInput.placeholder = "Écris le mot ou l'expression à chercher…";
                return;
            }
            const source = sourceSelect?.value || "nl-nl";
            const encoded = encodeURIComponent(term);
            let url;
            if (source === "nl-nl") url = "https://www.woorden.org/woord/" + encoded;
            else if (source === "ja-en") url = "https://jisho.org/search/" + encoded;
            else if (source === "ja-nl") url = "https://www.google.com/search?q=" + encodeURIComponent("site:japansnederlandswoordenboek.org " + term);
            else url = "https://www.google.com/search?q=" + encodeURIComponent(term + " dictionary translation");
            window.open(url, "_blank", "noopener,noreferrer");
        });

        difficultButton?.addEventListener("click", () => {
            showingDifficultOnly = !showingDifficultOnly;
            difficultButton.setAttribute("aria-pressed", String(showingDifficultOnly));
            difficultButton.textContent = showingDifficultOnly ? "← Revenir à la recherche" : "⚑ Afficher les cartes difficiles";
            if (showingDifficultOnly) renderDifficultCards();
            else renderSearchResults();
        });

        const renderSearchResults = () => {
            if (showingDifficultOnly) { renderDifficultCards(); return; }
            const rawQuery = cardSearchInput.value.trim();
            const query = normalizeSearch(rawQuery);
            cardSearchResults.replaceChildren();
            if (!query) {
                const hint = document.createElement("p");
                hint.className = "card-search-empty";
                hint.textContent = "Commence à taper pour rechercher dans tes decks et tes cartes.";
                cardSearchResults.appendChild(hint);
                return;
            }

            const decks = loadDecks();
            const deckMatches = decks.filter(deck => normalizeSearch(deck.name).includes(query));
            const cardMatches = [];
            decks.forEach(deck => {
                (Array.isArray(deck.cards) ? deck.cards : []).forEach((card, index) => {
                    const fields = Object.entries(card || {})
                        .filter(([key, value]) => typeof value === "string" && !["id"].includes(key))
                        .map(([, value]) => value);
                    if (normalizeSearch(fields.join(" ")).includes(query)) cardMatches.push({ deck, card, index });
                });
            });

            if (!deckMatches.length && !cardMatches.length) {
                const empty = document.createElement("p");
                empty.className = "card-search-empty";
                empty.textContent = "Aucun deck ni aucune carte trouvés pour « " + rawQuery + " ». ";
                cardSearchResults.appendChild(empty);
                return;
            }

            deckMatches.slice(0, 10).forEach(deck => {
                const count = Array.isArray(deck.cards) ? deck.cards.length : 0;
                makeSearchResult("Deck", deck.name, count + (count === 1 ? " carte" : " cartes") + " · Ouvrir le deck dans la liste", () => {
                    document.querySelector('[data-internal-tab="home"]')?.click();
                    setTimeout(() => {
                        const deckElements = [...document.querySelectorAll("#decks-container .deck")];
                        const target = deckElements.find(element => element.querySelector(".deck-name")?.textContent.trim() === deck.name);
                        target?.scrollIntoView({ behavior: "smooth", block: "center" });
                        if (target) {
                            target.style.outline = "3px solid #93b4ff";
                            setTimeout(() => { target.style.outline = ""; }, 1800);
                        }
                    }, 80);
                });
            });

            cardMatches.slice(0, 30).forEach(({ deck, card, index }) => {
                const title = [card.word, card.question, card.front, card.expression, card.term]
                    .find(value => typeof value === "string" && value.trim()) || "Carte " + (index + 1);
                const detail = [card.answer, card.translation, card.back, card.meaning, card.definition]
                    .find(value => typeof value === "string" && value.trim()) || "Deck : " + deck.name;
                makeSearchResult("Carte / mot", title, detail + " · Deck : " + deck.name, () => {
                    openInternalCardTab(deck.name, index);
                    document.getElementById("card-search-close")?.click();
                });
            });

            const total = deckMatches.length + cardMatches.length;
            const shown = Math.min(deckMatches.length, 10) + Math.min(cardMatches.length, 30);
            if (total > shown) {
                const more = document.createElement("p");
                more.className = "card-search-empty";
                more.textContent = shown + " résultats affichés sur " + total + ". Affine ta recherche pour en voir d'autres.";
                cardSearchResults.appendChild(more);
            }
        };

        cardSearchInput.addEventListener("input", renderSearchResults);
        renderSearchResults();
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

// Rafraîchir l’accueil après une fusion cloud terminée.
window.addEventListener("cloudDecksSynced", () => {
    displayDecks();
    displayForecast();
});