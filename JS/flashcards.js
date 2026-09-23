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
// SAUVEGARDE
// ==============================

async function saveDecks(
    decksToSave
) {

    /*
     * 1. Sauvegarde locale immédiate.
     */

    localStorage.setItem(
        "decks",
        JSON.stringify(
            decksToSave
        )
    );


    /*
     * 2. Sauvegarde Firestore.
     *
     * On attend réellement la fin
     * de cette sauvegarde.
     */

    if (
        typeof window.saveDecksToCloud ===
        "function"
    ) {

        try {

            await window.saveDecksToCloud(
                decksToSave
            );

            console.log(
                "Progression sauvegardée dans Firestore."
            );

        } catch (error) {

            console.error(
                "Erreur de synchronisation Firestore :",
                error
            );

        }
    }
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

    easyFactor: 1.3
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


    return [

        ...learningCards,

        ...limitedNew,

        ...limitedReview

    ];

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


    if (
        selectedDirection ===
        "fr-nl"
    ) {

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

    const total =
        queue.length;


    const position =
        total === 0
            ? 0
            : 1;


    progressElement.textContent =
        `${position} carte restante${
            total > 1 ? "s" : ""
        }`;

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


        ratingArea.classList.remove(
            "hidden"
        );


        displayButtonDelays();

        return;

    }


    answerElement.classList.remove(
        "hidden"
    );


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