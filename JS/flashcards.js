// ==============================
// FLASHCARDS — MON ANKI
// ==============================


const decks =
    JSON.parse(
        localStorage.getItem("decks")
    ) || [];


const selectedDeckName =
    localStorage.getItem("selectedDeck");


const selectedDirection =
    localStorage.getItem("selectedDirection") ||
    "random";


const selectedMode =
    localStorage.getItem("selectedMode") ||
    "flashcard";


const newCardLimit =
    Number(
        localStorage.getItem("newCardLimit")
    ) || 10;


const reviewLimit =
    Number(
        localStorage.getItem("reviewLimit")
    ) || 20;


// ==============================
// ELEMENTS HTML
// ==============================

const cardElement =
    document.getElementById("card");


const questionElement =
    document.getElementById("question");


const answerElement =
    document.getElementById("answer");


const resultElement =
    document.getElementById("result");


const metaElement =
    document.getElementById("meta");


const progressElement =
    document.getElementById("progress");


const showAnswerButton =
    document.getElementById("show-answer");


const showArea =
    document.getElementById("show-area");


const ratingArea =
    document.getElementById("rating-area");


const skipButton =
    document.getElementById("skip-button");


const undoButton =
    document.getElementById("undo-button");


const completionElement =
    document.getElementById("completion");


const completionText =
    document.getElementById("completion-text");


const writingArea =
    document.getElementById("writing-area");


const answerInput =
    document.getElementById("answer-input");


const drawingArea =
    document.getElementById("drawing-area");


const drawingCanvas =
    document.getElementById("drawing-canvas");


const clearDrawingButton =
    document.getElementById("clear-drawing");


const referenceDrawing =
    document.getElementById("reference-drawing");

const cardExtraTools = document.getElementById("card-extra-tools");
const cardDictionaryButton = document.getElementById("card-dictionary-button");
const cardDictionaryToggle = document.getElementById("card-dictionary-toggle");
const cardContextToggle = document.getElementById("card-context-toggle");
const cardContextPanel = document.getElementById("card-context-panel");
const cardContextSentence = document.getElementById("card-context-sentence");
const cardContextTranslation = document.getElementById("card-context-translation");
const cardContextSource = document.getElementById("card-context-source");
const cardContextNewButton = document.getElementById("card-context-new");
const cardContextGenerateButton = document.getElementById("card-context-generate");

const cardDictionaryPanel = document.getElementById("card-dictionary-panel");
const cardDictionaryTerm = document.getElementById("card-dictionary-term");
const cardDictionarySource = document.getElementById("card-dictionary-source");
const cardDifficultButton = document.getElementById("card-difficult-button");

function getCurrentSearchTerm() {
    if (!currentCard) return "";
    const pair = getQuestionAndAnswer(currentCard);
    return String(pair.question || pair.answer || "").trim();
}

function openDictionaryForCurrentCard() {
    const term = String(cardDictionaryTerm?.value || "").trim();
    if (!term) {
        cardDictionaryTerm?.focus();
        if (cardDictionaryTerm) cardDictionaryTerm.placeholder = "Écris le mot ou l'expression à rechercher…";
        return;
    }
    const source = cardDictionarySource?.value || "web";
    const encoded = encodeURIComponent(term);
    let url;
    if (source === "nl-nl") {
        url = "https://www.woorden.org/woord/" + encoded;
    } else if (source === "ja-en") {
        url = "https://jisho.org/search/" + encoded;
    } else if (source === "ja-nl") {
        url = "https://www.google.com/search?q=" + encodeURIComponent("site:japansnederlandswoordenboek.org " + term);
    } else {
        url = "https://www.google.com/search?q=" + encodeURIComponent(term + " dictionary translation");
    }
    window.open(url, "_blank", "noopener,noreferrer");
}

function refreshDifficultButton() {
    if (!cardDifficultButton || !currentCard) return;
    const difficult = currentCard.difficult === true;
    cardDifficultButton.textContent = difficult ? "⚑ Retirer des cartes difficiles" : "⚑ Marquer comme difficile";
    cardDifficultButton.classList.toggle("is-difficult", difficult);
    cardDifficultButton.setAttribute("aria-pressed", String(difficult));
}

cardDictionaryToggle?.addEventListener("click", () => {
    if (!cardDictionaryPanel || !cardDictionaryToggle) return;
    const willOpen = cardDictionaryPanel.classList.contains("hidden");
    cardDictionaryPanel.classList.toggle("hidden", !willOpen);
    cardDictionaryToggle.setAttribute("aria-expanded", String(willOpen));
    cardDictionaryToggle.textContent = willOpen ? "📖 Fermer le dictionnaire" : "📖 Ouvrir le dictionnaire";
    if (willOpen) cardDictionaryTerm?.focus();
});


// Exemples authentiques récupérés gratuitement sur Tatoeba (sans clé API).
function getContextSearchTerm() {
    if (!currentCard) return "";
    return String(currentCard.word || getQuestionAndAnswer(currentCard).question || "").trim();
}

function extractTatoebaSentences(payload) {
    // L'API Tatoeba renvoie normalement { data: [...] }, mais on accepte
    // plusieurs formes de réponse pour éviter de perdre les exemples.
    let candidates = Array.isArray(payload) ? payload :
        (payload?.data || payload?.results || payload?.sentences || payload?.items || []);
    if (!Array.isArray(candidates) && candidates && typeof candidates === "object") {
        candidates = candidates.sentences || candidates.results || [];
    }
    if (!Array.isArray(candidates)) return [];

    return candidates.map(item => {
        const sentence = item?.text || item?.sentence?.text ||
            (typeof item?.sentence === "string" ? item.sentence : "");
        let translation = "";
        const groups = item?.translations || item?.translation || [];
        const flat = Array.isArray(groups) ? groups.flat(Infinity) : [groups];

        for (const entry of flat) {
            if (typeof entry === "string") {
                if (!translation) translation = entry;
                continue;
            }
            if (!entry || typeof entry !== "object") continue;

            // Selon la réponse, la traduction peut être un objet phrase,
            // un groupe de traductions, ou contenir un tableau "sentences".
            const possible = [entry, entry.sentence, ...(Array.isArray(entry.sentences) ? entry.sentences : [])];
            for (const candidate of possible) {
                if (!candidate || typeof candidate !== "object") continue;
                const lang = candidate.lang || candidate.language || candidate.code;
                const text = candidate.text || candidate.translation;
                if (text && (!lang || ["fra", "fre", "fr"].includes(lang))) {
                    translation = text;
                    if (lang) break;
                }
            }
            if (translation) break;
        }

        return {
            id: item?.id || item?.sentence_id || item?.sentence?.id || null,
            sentence: String(sentence || "").trim(),
            translation: String(translation || "").trim()
        };
    }).filter(item => item.sentence);
}

// Générateur local expérimental : aucune API, aucune clé et aucun coût.
const localDutchContextPatterns = {
    "zodra": [
        { sentence: "Ik bel je zodra ik thuis ben.", translation: "Je t’appelle dès que je suis à la maison." },
        { sentence: "Zodra ik tijd heb, begin ik te studeren.", translation: "Dès que j’ai le temps, je commence à étudier." },
        { sentence: "Stuur me een bericht zodra je aankomt.", translation: "Envoie-moi un message dès que tu arrives." }
    ],
    "omdat": [
        { sentence: "Ik blijf thuis omdat ik moe ben.", translation: "Je reste à la maison parce que je suis fatigué." },
        { sentence: "Ik leer Nederlands omdat ik het graag spreek.", translation: "J’apprends le néerlandais parce que j’aime le parler." },
        { sentence: "Ze neemt een jas mee omdat het koud is.", translation: "Elle emporte une veste parce qu’il fait froid." }
    ],
    "hoewel": [
        { sentence: "Hoewel het regent, gaan we wandelen.", translation: "Bien qu’il pleuve, nous allons nous promener." },
        { sentence: "Hoewel ik moe ben, maak ik mijn huiswerk.", translation: "Bien que je sois fatigué, je fais mes devoirs." }
    ],
    "terwijl": [
        { sentence: "Ik luister naar muziek terwijl ik studeer.", translation: "J’écoute de la musique pendant que j’étudie." },
        { sentence: "Zij kookt terwijl hij de tafel dekt.", translation: "Elle cuisine pendant qu’il met la table." }
    ],
    "voordat": [
        { sentence: "Ik drink koffie voordat ik vertrek.", translation: "Je bois du café avant de partir." },
        { sentence: "Lees de tekst voordat je de vragen beantwoordt.", translation: "Lis le texte avant de répondre aux questions." }
    ],
    "nadat": [
        { sentence: "Nadat ik gegeten heb, ga ik wandelen.", translation: "Après avoir mangé, je vais me promener." },
        { sentence: "We praten verder nadat de les afgelopen is.", translation: "Nous continuons à discuter après la fin du cours." }
    ],
    "tenzij": [
        { sentence: "Ik ga fietsen, tenzij het te hard regent.", translation: "Je vais faire du vélo, sauf s’il pleut trop fort." },
        { sentence: "Je mag meegaan, tenzij je geen tijd hebt.", translation: "Tu peux venir, sauf si tu n’as pas le temps." }
    ],
    "zodat": [
        { sentence: "Ik schrijf het op zodat ik het niet vergeet.", translation: "Je le note pour ne pas l’oublier." },
        { sentence: "Praat langzaam zodat iedereen je begrijpt.", translation: "Parle lentement pour que tout le monde te comprenne." }
    ],
    "daarom": [
        { sentence: "Ik ben moe, daarom ga ik vroeg naar bed.", translation: "Je suis fatigué, c’est pourquoi je me couche tôt." },
        { sentence: "Het regent; daarom nemen we de bus.", translation: "Il pleut ; c’est pourquoi nous prenons le bus." }
    ]
};

function generateLocalContextExample() {
    const term = getContextSearchTerm();
    if (!term) return null;
    const normalized = term.toLocaleLowerCase("nl-NL").trim().replace(/[.!?]+$/, "");
    const patterns = localDutchContextPatterns[normalized];
    if (patterns?.length) {
        const available = patterns.filter(item =>
            !(currentCard.contextExamples || []).some(old => old.sentence === item.sentence)
        );
        const choices = available.length ? available : patterns;
        const example = choices[Math.floor(Math.random() * choices.length)];
        return { ...example, id: "local:" + normalized + ":" + example.sentence, generated: true };
    }
    return {
        sentence: "Ik probeer het woord ‘" + term + "’ in een zin te gebruiken.",
        translation: "J’essaie d’utiliser le mot « " + term + " » dans une phrase.",
        id: "local:meta:" + normalized,
        generated: true
    };
}

function showLocalContextExample() {
    if (!currentCard) return;
    const example = generateLocalContextExample();
    if (!example) {
        renderContextExample(null, "Impossible d’identifier le mot sur cette carte.");
        return;
    }
    if (!Array.isArray(currentCard.contextExamples)) currentCard.contextExamples = [];
    currentCard.contextExamples.push(example);
    currentCard.contextLastId = example.id;
    saveDecks(decks);
    renderContextExample(example);
    if (cardContextSource) {
        cardContextSource.textContent = example.id.startsWith("local:meta:")
            ? "Phrase générée localement · modèle de secours : elle parle du mot, pas nécessairement de son sens naturel."
            : "Phrase générée localement · modèle grammatical prédéfini, sans IA.";
    }
}

function renderContextExample(example, message = "") {
    if (cardContextSentence) cardContextSentence.textContent = example?.sentence || message || "Aucun exemple disponible.";
    if (cardContextTranslation) cardContextTranslation.textContent = example?.translation || (example?.sentence ? "Traduction française non disponible." : "");
    if (cardContextSource) cardContextSource.textContent = example?.id
        ? "Source : Tatoeba · les traductions communautaires peuvent contenir des erreurs."
        : "Source : recherche Tatoeba.";
}

async function loadContextExample(forceNew = false) {
    if (!currentCard || !cardContextSentence) return;
    const term = getContextSearchTerm();
    if (!term) {
        renderContextExample(null, "Impossible d'identifier le mot sur cette carte.");
        return;
    }
    if (!Array.isArray(currentCard.contextExamples)) currentCard.contextExamples = [];
    const seen = currentCard.contextExamples;
    if (!forceNew && seen.length) {
        const cached = seen.find(item => String(item.id || item.sentence) === String(currentCard.contextLastId)) || seen[0];
        renderContextExample(cached);
        return;
    }
    if (cardContextNewButton) cardContextNewButton.disabled = true;
    renderContextExample(null, "Recherche d'une phrase…");
    try {
        // On tente d'abord les phrases néerlandaises avec traduction française,
        // puis on élargit la recherche si Tatoeba ne trouve aucune correspondance.
        const searches = [
            { q: term, lang: "nld", "trans:lang": "fra", showtrans: "all", limit: "20" },
            { q: term, lang: "nld", showtrans: "all", limit: "20" }
        ];
        let all = [];
        let lastError = null;

        for (const search of searches) {
            const params = new URLSearchParams(search);
            try {
                const response = await fetch("https://api.tatoeba.org/v1/sentences?" + params.toString(), {
                    headers: { Accept: "application/json" }
                });
                if (!response.ok) throw new Error("Tatoeba HTTP " + response.status);
                const payload = await response.json();
                all = extractTatoebaSentences(payload);
                if (all.length) break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!all.length && lastError) throw lastError;
        const fresh = all.filter(item => !seen.some(old => old.id && item.id && old.id === item.id));
        const choices = fresh.length ? fresh : all;
        if (!choices.length) {
            renderContextExample(null, "Aucune phrase trouvée pour ce mot. Essaie un autre mot ou réessaie plus tard.");
            return;
        }
        const example = choices[Math.floor(Math.random() * choices.length)];
        if (!seen.some(old => old.id && example.id && old.id === example.id)) seen.push(example);
        currentCard.contextLastId = example.id || example.sentence;
        saveDecks(decks);
        renderContextExample(example);
    } catch (error) {
        console.warn("Tatoeba : recherche de phrase impossible", error);
        renderContextExample(null, "La recherche n'a pas abouti. Vérifie la connexion et réessaie.");
    } finally {
        if (cardContextNewButton) cardContextNewButton.disabled = false;
    }
}

cardContextToggle?.addEventListener("click", async () => {
    if (!cardContextPanel || !cardContextToggle) return;
    const willOpen = cardContextPanel.classList.contains("hidden");
    cardContextPanel.classList.toggle("hidden", !willOpen);
    cardContextToggle.setAttribute("aria-expanded", String(willOpen));
    cardContextToggle.textContent = willOpen ? "💬 Masquer la phrase" : "💬 Phrase de contexte";
    if (willOpen) await loadContextExample(false);
});
cardContextNewButton?.addEventListener("click", () => loadContextExample(true));
cardContextGenerateButton?.addEventListener("click", showLocalContextExample);

cardDictionaryButton?.addEventListener("click", openDictionaryForCurrentCard);
cardDifficultButton?.addEventListener("click", async () => {
    if (!currentCard) return;
    currentCard.difficult = currentCard.difficult !== true;
    currentCard.updatedAt = Date.now();
    refreshDifficultButton();
    await saveDecks(decks);
});


// ==============================
// DECK
// ==============================

const deck =
    decks.find(
        d => d.name === selectedDeckName
    );


if (!deck) {

    alert("Deck introuvable.");

    window.location.href =
        "index.html";

    throw new Error(
        "Deck introuvable."
    );
}


const cards =
    Array.isArray(deck.cards)
        ? deck.cards
        : [];



 // ==============================
 // SAUVEGARDE — LOCAL D'ABORD
 // ==============================

function saveDecks(decksToSave) {
    // 1. Enregistrer immédiatement sur cet appareil.
    try {
        localStorage.setItem(
            "decks",
            JSON.stringify(decksToSave)
        );
    } catch (error) {
        console.error(
            "Erreur de sauvegarde locale :",
            error
        );

        return false;
    }

    // 2. Déclencher la sauvegarde cloud sans l'attendre.
    // L'affichage des cartes ne dépend donc pas du réseau.
    if (typeof window.saveDecksToCloud === "function") {
        try {
            window.saveDecksToCloud(decksToSave);
        } catch (error) {
            console.warn(
                "La sauvegarde cloud sera à réessayer :",
                error
            );
        }
    }

    return true;
}



// ==============================
// PARAMETRES SRS
// ==============================

const defaultSettings = {

    learningSteps: [
        1,
        10
    ],

    graduatingInterval: 1,

    easyInterval: 4,

    hardFactor: 1.2,

    goodFactor: 2.5,

    easyFactor: 4
};


// ==============================
// NORMALISATION DES CARTES
// ==============================

cards.forEach(
    card => {

        if (
            typeof card.level !==
            "number"
        ) {
            card.level = 0;
        }


        if (
            typeof card.interval !==
            "number"
        ) {
            card.interval = 1;
        }


        if (
            typeof card.nextReview !==
            "number"
        ) {
            card.nextReview = 0;
        }


        if (
            typeof card.reps !==
            "number"
        ) {
            card.reps = 0;
        }


        if (!card.state) {
            card.state = "new";
        }


        if (
            typeof card.step !==
            "number"
        ) {
            card.step = 0;
        }


        if (!card.mode) {
            card.mode = "text";
        }

    }
);


// ==============================
// DATE ACTUELLE
// ==============================

function now() {

    return Date.now();

}


// ==============================
// MELANGE ALEATOIRE
// ==============================

function shuffleArray(
    array
) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            array[i],
            array[j]
        ] =
        [
            array[j],
            array[i]
        ];

    }


    return array;

}


// ==============================
// FILE DE CARTES
// ==============================

function buildQueue() {

    const currentTime =
        now();


    const newCards =
        cards.filter(
            card =>
                card.state === "new"
        );


    const learningCards =
        cards.filter(
            card =>
                card.state === "learning" &&
                card.nextReview <= currentTime
        );


    const reviewCards =
        cards.filter(
            card =>
                card.state === "review" &&
                card.nextReview <= currentTime
        );


    const limitedNew =
        newCards.slice(
            0,
            newCardLimit
        );


    const limitedReview =
        reviewCards.slice(
            0,
            reviewLimit
        );


    const newQueue = [

        ...learningCards,

        ...limitedNew,

        ...limitedReview

    ];



    /*
     * On mélange toujours l'ordre des cartes
     * au début de chaque session.
     *
     * L'ordre réel des cartes dans le deck
     * n'est pas modifié.
     */

    shuffleArray(newQueue);

    return newQueue;


}


let queue =
    buildQueue();


// ==============================
// ETAT SESSION
// ==============================

let currentCard =
    null;


let lastAction =
    null;


// ==============================
// MODE EFFECTIF
// ==============================

function getEffectiveModeForCard(
    card
) {

    if (
        card.mode ===
        "drawing"
    ) {

        return "drawing";

    }


    if (
        selectedMode ===
        "drawing"
    ) {

        return "flashcard";

    }


    return selectedMode;

}


// ==============================
// QUESTION / REPONSE
// ==============================

function getQuestionAndAnswer(
    card
) {

    const effectiveMode =
        getEffectiveModeForCard(
            card
        );


    if (
        effectiveMode ===
        "drawing"
    ) {

        return {

            question:
                card.word,

            answer:
                card.answer

        };

    }


    /*
     * fr-nl : question en français, réponse en néerlandais.
     * nl-fr : question en néerlandais, réponse en français.
     * random : choisit un sens différent au hasard pour chaque carte.
     */
    const reverseDirection =
        selectedDirection === "fr-nl" ||
        (
            selectedDirection === "random" &&
            Math.random() < 0.5
        );

    if (reverseDirection) {

        return {

            question:
                card.answer,

            answer:
                card.word

        };

    }


    return {

        question:
            card.word,

        answer:
            card.answer

    };

}


// ==============================
// NORMALISATION TEXTE
// ==============================

function normalizeText(
    text
) {

    return text
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        );

}


// ==============================
// AFFICHAGE CARTE
// ==============================

function displayCard() {

    if (
        queue.length === 0
    ) {

        finishSession();

        return;

    }


    currentCard =
        queue[0];


    const {
        question,
        answer
    } =
        getQuestionAndAnswer(
            currentCard
        );


    questionElement.textContent =
        question;


    answerElement.textContent =
        answer;


    answerElement.classList.add(
        "hidden"
    );

    cardExtraTools?.classList.add("hidden");
    cardDictionaryPanel?.classList.add("hidden");
    cardContextPanel?.classList.add("hidden");
    if (cardContextToggle) {
        cardContextToggle.textContent = "💬 Phrase de contexte";
        cardContextToggle.setAttribute("aria-expanded", "false");
    }
    if (cardDictionaryToggle) {
        cardDictionaryToggle.textContent = "📖 Ouvrir le dictionnaire";
        cardDictionaryToggle.setAttribute("aria-expanded", "false");
    }
    if (cardDictionaryTerm) cardDictionaryTerm.value = "";
    refreshDifficultButton();

    resultElement.textContent =
        "";


    resultElement.className =
        "";


    metaElement.textContent =
        "";


    referenceDrawing.classList.add(
        "hidden"
    );


    referenceDrawing.src =
        "";


    writingArea.classList.add(
        "hidden"
    );


    drawingArea.classList.add(
        "hidden"
    );


    showArea.style.display =
        "block";


    ratingArea.classList.add(
        "hidden"
    );


    showAnswerButton.disabled =
        false;


    if (
        answerInput
    ) {

        answerInput.value =
            "";

    }


    const effectiveMode =
        getEffectiveModeForCard(
            currentCard
        );


    if (
        effectiveMode ===
        "writing"
    ) {

        writingArea.classList.remove(
            "hidden"
        );

        answerInput.focus();

    }


    if (
        effectiveMode ===
        "drawing"
    ) {

        drawingArea.classList.remove(
            "hidden"
        );

        clearCanvas();

    }


    updateProgress();

}


// ==============================
// PROGRESSION
// ==============================

function updateProgress() {

    const total = queue.length;

    progressElement.textContent =
        `${total} carte${total > 1 ? "s" : ""} restante${total > 1 ? "s" : ""}`;

}


// ==============================
// VOIR LA REPONSE
// ==============================

showAnswerButton.addEventListener(
    "click",
    showAnswer
);


function showAnswer() {

    if (!currentCard) {
        return;
    }


    const effectiveMode =
        getEffectiveModeForCard(
            currentCard
        );


    showAnswerButton.disabled =
        true;


    if (
        effectiveMode ===
        "drawing"
    ) {

        if (
            currentCard.drawing
        ) {

            referenceDrawing.src =
                currentCard.drawing;


            referenceDrawing.classList.remove(
                "hidden"
            );

        }


        showArea.style.display =
            "none";

        cardExtraTools?.classList.remove("hidden");
        if (cardDictionaryTerm) cardDictionaryTerm.value = getCurrentSearchTerm();
        refreshDifficultButton();

        ratingArea.classList.remove(
            "hidden"
        );


        displayButtonDelays();

        return;

    }


    answerElement.classList.remove(
        "hidden"
    );

    // Le dictionnaire n'est disponible qu'après révélation de la réponse.
    cardExtraTools?.classList.remove("hidden");
    if (cardDictionaryTerm) cardDictionaryTerm.value = getCurrentSearchTerm();
    refreshDifficultButton();

    showArea.style.display =
        "none";


    if (
        effectiveMode ===
        "writing"
    ) {

        checkWritingAnswer();

        return;

    }


    ratingArea.classList.remove(
        "hidden"
    );


    displayButtonDelays();

}


// ==============================
// REPONSE ECRITE
// ==============================

function checkWritingAnswer() {

    const userAnswer =
        normalizeText(
            answerInput.value
        );


    const correctAnswer =
        normalizeText(
            answerElement.textContent
        );


    if (
        userAnswer ===
        correctAnswer
    ) {

        resultElement.textContent =
            "✓ Correct !";


        resultElement.className =
            "correct";


        ratingArea.classList.remove(
            "hidden"
        );


        displayButtonDelays();

        return;

    }


    resultElement.textContent =
        `✗ Incorrect. Réponse : ${answerElement.textContent}`;


    resultElement.className =
        "incorrect";


    showWritingCorrectionButtons();

}


// ==============================
// REPONSE INCORRECTE
// ==============================

function showWritingCorrectionButtons() {

    ratingArea.innerHTML = `

        <button id="writing-again">
            Again
        </button>

        <button id="writing-good">
            Good
        </button>

    `;


    ratingArea.classList.remove(
        "hidden"
    );


    document
        .getElementById(
            "writing-again"
        )
        .addEventListener(
            "click",
            async () => {

                await rateCard(
                    "again"
                );

            }
        );


    document
        .getElementById(
            "writing-good"
        )
        .addEventListener(
            "click",
            () => {

                /*
                 * Ce Good ne valide pas encore
                 * la carte dans le SRS.
                 *
                 * Il signifie simplement :
                 * "ma réponse était correcte,
                 * j'ai fait une faute de frappe".
                 *
                 * On affiche donc ensuite
                 * les 4 vrais boutons.
                 */

                restoreRatingButtons();

                displayButtonDelays();

            }
        );

}


// ==============================
// 4 BOUTONS DE VALIDATION
// ==============================

function restoreRatingButtons() {

    ratingArea.innerHTML = `

        <button data-rating="again">

            Again

            <span
                id="again-delay"
                class="rating-delay"
            ></span>

        </button>


        <button data-rating="hard">

            Hard

            <span
                id="hard-delay"
                class="rating-delay"
            ></span>

        </button>


        <button data-rating="good">

            Good

            <span
                id="good-delay"
                class="rating-delay"
            ></span>

        </button>


        <button data-rating="easy">

            Easy

            <span
                id="easy-delay"
                class="rating-delay"
            ></span>

        </button>

    `;


    ratingArea
        .querySelectorAll(
            "[data-rating]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const rating =
                            button.dataset.rating;


                        await rateCard(
                            rating
                        );

                    }
                );

            }
        );

}


// ==============================
// DELAIS DES BOUTONS
// ==============================

function displayButtonDelays() {

    restoreRatingButtons();


    const ratings = [

        "again",

        "hard",

        "good",

        "easy"

    ];


    ratings.forEach(
        rating => {

            const element =
                document.getElementById(
                    `${rating}-delay`
                );


            if (!element) {
                return;
            }


            element.textContent =
                getRatingDelay(
                    rating
                );

        }
    );

}


// ==============================
// CALCUL DES DELAIS
// ==============================

function getRatingDelay(
    rating
) {

    if (!currentCard) {
        return "";
    }


    const card =
        currentCard;


    if (
        card.state ===
        "new"
    ) {

        if (
            rating === "again"
        ) {
            return "1 min";
        }


        if (
            rating === "hard"
        ) {
            return "6 min";
        }


        if (
            rating === "good"
        ) {
            return "1 j";
        }


        if (
            rating === "easy"
        ) {
            return "4 j";
        }

    }


    if (
        card.state ===
        "learning"
    ) {

        if (
            rating === "again"
        ) {
            return "1 min";
        }


        if (
            rating === "hard"
        ) {
            return "6 min";
        }


        if (
            rating === "good"
        ) {
            return "1 j";
        }


        if (
            rating === "easy"
        ) {
            return "4 j";
        }

    }


    if (
        card.state ===
        "review"
    ) {

        const interval =
            card.interval || 1;


        if (
            rating === "again"
        ) {
            return "10 min";
        }


        if (
            rating === "hard"
        ) {

            return `${Math.max(
                1,
                Math.round(
                    interval *
                    defaultSettings.hardFactor
                )
            )} j`;

        }


        if (
            rating === "good"
        ) {

            return `${Math.max(
                1,
                Math.round(
                    interval *
                    defaultSettings.goodFactor
                )
            )} j`;

        }


        if (
            rating === "easy"
        ) {

            return `${Math.max(
                1,
                Math.round(
                    interval *
                    defaultSettings.easyFactor
                )
            )} j`;

        }

    }


    return "";

}


// ==============================
// PLANIFICATION SRS
// ==============================

function scheduleCard(
    rating
) {

    const card =
        currentCard;


    if (!card) {
        return;
    }


    const currentTime =
        now();


    if (
        rating === "again"
    ) {

        card.state =
            "learning";


        card.step =
            0;


        card.interval =
            1;


        card.nextReview =
            currentTime +
            1 *
            60 *
            1000;


        card.reps++;


        return;

    }


    if (
        card.state ===
        "new"
    ) {

        if (
            rating === "hard"
        ) {

            card.state =
                "learning";


            card.step =
                0;


            card.nextReview =
                currentTime +
                6 *
                60 *
                1000;


            card.interval =
                1;


            card.reps++;


            return;

        }


        if (
            rating === "good"
        ) {

            card.state =
                "review";


            card.interval =
                defaultSettings
                    .graduatingInterval;


            card.nextReview =
                currentTime +
                card.interval *
                24 *
                60 *
                60 *
                1000;


            card.reps++;


            return;

        }


        if (
            rating === "easy"
        ) {

            card.state =
                "review";


            card.interval =
                defaultSettings
                    .easyInterval;


            card.nextReview =
                currentTime +
                card.interval *
                24 *
                60 *
                60 *
                1000;


            card.reps++;


            return;

        }

    }


    if (
        card.state ===
        "learning"
    ) {

        if (
            rating === "hard"
        ) {

            card.nextReview =
                currentTime +
                6 *
                60 *
                1000;


            card.reps++;


            return;

        }


        if (
            rating === "good"
        ) {

            card.state =
                "review";


            card.interval =
                defaultSettings
                    .graduatingInterval;


            card.nextReview =
                currentTime +
                card.interval *
                24 *
                60 *
                60 *
                1000;


            card.reps++;


            return;

        }


        if (
            rating === "easy"
        ) {

            card.state =
                "review";


            card.interval =
                defaultSettings
                    .easyInterval;


            card.nextReview =
                currentTime +
                card.interval *
                24 *
                60 *
                60 *
                1000;


            card.reps++;


            return;

        }

    }


    if (
        card.state ===
        "review"
    ) {

        const interval =
            card.interval || 1;


        if (
            rating === "again"
        ) {

            card.state =
                "learning";


            card.step =
                0;


            card.nextReview =
                currentTime +
                1 *
                60 *
                1000;


            card.interval =
                1;


            card.reps++;


            return;

        }


        if (
            rating === "hard"
        ) {

            card.interval =
                Math.max(
                    1,
                    Math.round(
                        interval *
                        defaultSettings
                            .hardFactor
                    )
                );

        }


        if (
            rating === "good"
        ) {

            card.interval =
                Math.max(
                    1,
                    Math.round(
                        interval *
                        defaultSettings
                            .goodFactor
                    )
                );

        }


        if (
            rating === "easy"
        ) {

            card.interval =
                Math.max(
                    1,
                    Math.round(
                        interval *
                        defaultSettings
                            .easyFactor
                    )
                );

        }


        card.nextReview =
            currentTime +
            card.interval *
            24 *
            60 *
            60 *
            1000;


        card.reps++;

    }

}


// ==============================
// NOTATION D'UNE CARTE
// ==============================

async function rateCard(
    rating
) {

    if (!currentCard) {
        return;
    }


    const previousState =
        JSON.parse(
            JSON.stringify(
                currentCard
            )
        );


    lastAction = {

        card:
            currentCard,

        previousState:
            previousState,

        rating:
            rating

    };


    /*
     * Modification du SRS.
     */

    scheduleCard(
        rating
    );

    currentCard.updatedAt = Date.now();


    /*
     * IMPORTANT :
     *
     * On attend que la sauvegarde soit
     * réellement terminée avant de
     * passer à la carte suivante.
     */

    await saveDecks(
        decks
    );


    /*
     * La carte quitte la file.
     */

    queue.shift();


    /*
     * Again :
     * elle revient dans la session.
     */

    if (
        rating === "again"
    ) {

        queue.push(
            currentCard
        );

    }


    currentCard =
        null;


    undoButton.classList.remove(
        "hidden"
    );


    displayCard();

}


// ==============================
// ANNULER
// ==============================

undoButton.addEventListener(
    "click",
    async () => {

        await undoLastRating();

    }
);


async function undoLastRating() {

    if (!lastAction) {
        return;
    }


    const {
        card,
        previousState,
        rating
    } =
        lastAction;


    Object.assign(
        card,
        previousState
    );
    // L'annulation est elle aussi une modification synchronisable.
    card.updatedAt = Date.now();


    if (
        !queue.includes(card)
    ) {

        queue.unshift(
            card
        );

    }


    if (
        rating === "again"
    ) {

        const index =
            queue.indexOf(
                card
            );


        if (
            index !== -1
        ) {

            queue.splice(
                index,
                1
            );

        }


        queue.unshift(
            card
        );

    }


    /*
     * Sauvegarde également
     * l'annulation.
     */

    await saveDecks(
        decks
    );


    lastAction =
        null;


    undoButton.classList.add(
        "hidden"
    );


    currentCard =
        null;


    displayCard();

}


// ==============================
// PASSER
// ==============================

skipButton.addEventListener(
    "click",
    skipCard
);


function skipCard() {

    if (!currentCard) {
        return;
    }


    currentCard.updatedAt = Date.now();
    saveDecks(decks);

    queue.shift();

    queue.push(
        currentCard
    );


    currentCard =
        null;


    displayCard();

}


// ==============================
// FIN DE SESSION
// ==============================

async function finishSession() {

    /*
     * Dernière sauvegarde de sécurité.
     */

    await saveDecks(
        decks
    );


    cardElement.classList.add(
        "hidden"
    );


    showArea.style.display =
        "none";


    ratingArea.classList.add(
        "hidden"
    );


    skipButton.classList.add(
        "hidden"
    );


    completionElement.classList.remove(
        "hidden"
    );


    completionText.textContent =
        "Tu as terminé toutes les cartes prévues pour cette session.";

}


// ==============================
// DESSIN
// ==============================

const ctx =
    drawingCanvas.getContext(
        "2d"
    );


let isDrawing =
    false;


function getCanvasPosition(
    event
) {

    const rect =
        drawingCanvas.getBoundingClientRect();


    return {

        x:
            (event.clientX -
                rect.left) *
            (
                drawingCanvas.width /
                rect.width
            ),

        y:
            (event.clientY -
                rect.top) *
            (
                drawingCanvas.height /
                rect.height
            )

    };

}


drawingCanvas.addEventListener(
    "pointerdown",
    event => {

        isDrawing =
            true;


        const position =
            getCanvasPosition(
                event
            );


        ctx.beginPath();


        ctx.moveTo(
            position.x,
            position.y
        );

    }
);


drawingCanvas.addEventListener(
    "pointermove",
    event => {

        if (!isDrawing) {
            return;
        }


        const position =
            getCanvasPosition(
                event
            );


        ctx.lineTo(
            position.x,
            position.y
        );


        ctx.stroke();

    }
);


drawingCanvas.addEventListener(
    "pointerup",
    () => {

        isDrawing =
            false;

    }
);


drawingCanvas.addEventListener(
    "pointerleave",
    () => {

        isDrawing =
            false;

    }
);


function clearCanvas() {

    ctx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );

}


clearDrawingButton.addEventListener(
    "click",
    clearCanvas
);


// ==============================
// RACCOURCIS CLAVIER
// ==============================

document.addEventListener(
    "keydown",
    event => {

        /*
         * Entrée dans le champ
         * d'écriture.
         */

        if (
            event.key === "Enter" &&
            document.activeElement ===
                answerInput
        ) {

            event.preventDefault();


            if (
                !showAnswerButton.disabled
            ) {

                showAnswer();

            }


            return;

        }


        /*
         * Raccourcis uniquement
         * avec les 4 boutons.
         */

        if (
            ratingArea.classList.contains(
                "hidden"
            )
        ) {

            return;

        }


        if (
            event.key === "1"
        ) {

            const button =
                ratingArea.querySelector(
                    '[data-rating="again"]'
                );


            if (button) {
                button.click();
            }

        }


        if (
            event.key === "2"
        ) {

            const button =
                ratingArea.querySelector(
                    '[data-rating="hard"]'
                );


            if (button) {
                button.click();
            }

        }


        if (
            event.key === "3"
        ) {

            const button =
                ratingArea.querySelector(
                    '[data-rating="good"]'
                );


            if (button) {
                button.click();
            }

        }


        if (
            event.key === "4"
        ) {

            const button =
                ratingArea.querySelector(
                    '[data-rating="easy"]'
                );


            if (button) {
                button.click();
            }

        }

    }
);


// ==============================
// INITIALISATION
// ==============================

restoreRatingButtons();

displayCard();