// ==============================
// CHARGEMENT DES DECKS
// ==============================

function loadDecks() {

    const saved =
        localStorage.getItem("decks");


    if (!saved) {

        return [];

    }


    try {

        return JSON.parse(saved);

    } catch (error) {

        console.error(error);

        return [];

    }

}


// ==============================
// SAUVEGARDE
// ==============================

function saveDecks(decks) {

    localStorage.setItem(
        "decks",
        JSON.stringify(decks)
    );

}


// ==============================
// ÉLÉMENTS
// ==============================

const questionElement =
    document.querySelector("#question");


const answerElement =
    document.querySelector("#answer");


const writingArea =
    document.querySelector("#writing-area");


const answerInput =
    document.querySelector("#answer-input");


const resultElement =
    document.querySelector("#result");


const metaElement =
    document.querySelector("#meta");


const showArea =
    document.querySelector("#show-area");


const showAnswerButton =
    document.querySelector("#show-answer");


const ratingArea =
    document.querySelector("#rating-area");


const skipButton =
    document.querySelector("#skip-button");


const undoButton =
    document.querySelector("#undo-button");


const completionElement =
    document.querySelector("#completion");


// ==============================
// DESSIN
// ==============================

const drawingArea =
    document.querySelector("#drawing-area");


const referenceDrawingElement =
    document.querySelector("#reference-drawing");


const drawingCanvas =
    document.querySelector("#drawing-canvas");


const clearDrawingButton =
    document.querySelector("#clear-drawing");


let drawingContext =
    null;


let isDrawing =
    false;


let lastDrawingX =
    0;


let lastDrawingY =
    0;


if (drawingCanvas) {

    drawingContext =
        drawingCanvas.getContext("2d");

}


// ==============================
// PARAMÈTRES SRS
// ==============================

const defaultSettings = {

    learningSteps: [1, 10],

    graduatingInterval: 1,

    easyInterval: 4,

    hardFactor: 1.2,

    goodFactor: 2.5,

    easyFactor: 1.3

};


// ==============================
// DECK
// ==============================

const decks =
    loadDecks();


const selectedDeckName =
    localStorage.getItem(
        "selectedDeck"
    );


const selectedDeck =
    decks.find(
        deck =>
            deck.name === selectedDeckName
    );


if (!selectedDeck) {

    alert(
        "Deck introuvable."
    );

    window.location.href =
        "index.html";

}


// ==============================
// PARAMÈTRES DE SESSION
// ==============================

let direction =
    localStorage.getItem(
        "selectedDirection"
    ) || "random";


let mode =
    localStorage.getItem(
        "selectedMode"
    ) || "flashcard";


const newCardLimit =
    Number(
        localStorage.getItem(
            "newCardLimit"
        )
    ) || 20;


const reviewLimit =
    Number(
        localStorage.getItem(
            "reviewLimit"
        )
    ) || 50;


// ==============================
// NORMALISER LES ANCIENS MODES
// ==============================

if (mode === "flashcards") {

    mode =
        "flashcard";

}


// ==============================
// INITIALISATION DES CARTES
// ==============================

selectedDeck.cards.forEach(
    card => {

        if (
            card.level === undefined
        ) {

            card.level = 0;

        }


        if (
            card.interval === undefined
        ) {

            card.interval = 1;

        }


        if (
            card.nextReview === undefined
        ) {

            card.nextReview = 0;

        }


        if (
            card.reps === undefined
        ) {

            card.reps = 0;

        }


        if (
            card.state === undefined
        ) {

            card.state =
                "new";

        }


        if (
            card.step === undefined
        ) {

            card.step = 0;

        }


        /*
         * Les anciennes cartes n'ont pas
         * de mode : elles restent des cartes texte.
         */

        if (
            card.mode === undefined
        ) {

            card.mode =
                "text";

        }

    }
);


// ==============================
// FILE DE CARTES
// ==============================

let queue = [];


let currentCard =
    null;


let currentDirection =
    null;


/*
 * Garde une trace de la dernière
 * note donnée, pour pouvoir l'annuler.
 */

let lastAction =
    null;


// ==============================
// UTILITAIRES
// ==============================

function shuffle(array) {

    const copy =
        [...array];


    for (
        let i = copy.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );


        [
            copy[i],
            copy[j]
        ] =
        [
            copy[j],
            copy[i]
        ];

    }


    return copy;

}


// ==============================
// CARTES DUES
// ==============================

function isDue(card) {

    return (
        !card.nextReview ||
        card.nextReview <= Date.now()
    );

}


// ==============================
// CONSTRUIRE LA FILE
// ==============================

function buildQueue() {

    const newCards =
        selectedDeck.cards.filter(
            card =>
                card.state === "new"
        );


    const reviewCards =
        selectedDeck.cards.filter(
            card =>
                card.state !== "new" &&
                isDue(card)
        );


    const selectedNewCards =
        shuffle(
            newCards
        ).slice(
            0,
            newCardLimit
        );


    const selectedReviewCards =
        shuffle(
            reviewCards
        ).slice(
            0,
            reviewLimit
        );


    return [
        ...selectedNewCards,
        ...selectedReviewCards
    ];

}


// ==============================
// DIRECTION
// ==============================

function chooseDirection() {

    if (
        direction === "fr-nl"
    ) {

        return "fr-nl";

    }


    if (
        direction === "nl-fr"
    ) {

        return "nl-fr";

    }


    /*
     * Pour le mode random,
     * on choisit une direction
     * pour chaque carte.
     */

    return Math.random() < 0.5
        ? "fr-nl"
        : "nl-fr";

}


// ==============================
// QUESTION / RÉPONSE
// ==============================

function getQuestionAndAnswer(
    card
) {

    /*
     * Les cartes "dessin" n'ont pas de
     * texte de réponse : la réponse est
     * l'image stockée dans card.drawing.
     * On ne leur applique donc pas le sens
     * fr-nl / nl-fr, qui viderait la question
     * quand card.answer est vide.
     */

    if (
        card.mode === "drawing"
    ) {

        currentDirection =
            "drawing";


        return {

            question:
                card.word,

            answer:
                card.answer

        };

    }


    const selectedDirection =
        chooseDirection();


    currentDirection =
        selectedDirection;


    if (
        selectedDirection === "fr-nl"
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
// DESSIN : POSITION
// ==============================

function getCanvasPosition(
    event
) {

    const rect =
        drawingCanvas.getBoundingClientRect();


    return {

        x:
            (
                event.clientX -
                rect.left
            ) *
            (
                drawingCanvas.width /
                rect.width
            ),

        y:
            (
                event.clientY -
                rect.top
            ) *
            (
                drawingCanvas.height /
                rect.height
            )

    };

}


// ==============================
// DESSIN : COMMENCER
// ==============================

function startDrawing(
    event
) {

    if (!drawingCanvas) {

        return;

    }


    /*
     * Avec une souris, seul le clic gauche
     * démarre le dessin.
     */

    if (
        event.pointerType === "mouse" &&
        event.button !== 0
    ) {

        return;

    }


    event.preventDefault();


    isDrawing =
        true;


    drawingCanvas.setPointerCapture(
        event.pointerId
    );


    const position =
        getCanvasPosition(
            event
        );


    lastDrawingX =
        position.x;


    lastDrawingY =
        position.y;


    /*
     * Petit point pour que le dessin
     * fonctionne même avec un simple clic.
     */

    drawingContext.beginPath();

    drawingContext.arc(
        position.x,
        position.y,
        4,
        0,
        Math.PI * 2
    );

    drawingContext.fillStyle =
        "#222";

    drawingContext.fill();

}


// ==============================
// DESSIN : DESSINER
// ==============================

function draw(
    event
) {

    if (
        !isDrawing ||
        !drawingContext
    ) {

        return;

    }


    event.preventDefault();


    const position =
        getCanvasPosition(
            event
        );


    drawingContext.beginPath();

    drawingContext.moveTo(
        lastDrawingX,
        lastDrawingY
    );

    drawingContext.lineTo(
        position.x,
        position.y
    );


    drawingContext.lineWidth =
        5;


    drawingContext.lineCap =
        "round";


    drawingContext.lineJoin =
        "round";


    drawingContext.strokeStyle =
        "#222";


    drawingContext.stroke();


    lastDrawingX =
        position.x;


    lastDrawingY =
        position.y;

}


// ==============================
// DESSIN : ARRÊTER
// ==============================

function stopDrawing(
    event
) {

    if (!isDrawing) {

        return;

    }


    isDrawing =
        false;


    if (
        drawingCanvas.hasPointerCapture(
            event.pointerId
        )
    ) {

        drawingCanvas.releasePointerCapture(
            event.pointerId
        );

    }

}


// ==============================
// EFFACER LE DESSIN
// ==============================

function clearDrawing() {

    if (
        !drawingContext ||
        !drawingCanvas
    ) {

        return;

    }


    drawingContext.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );

}


// ==============================
// INITIALISER LE DESSIN
// ==============================

function resetDrawing() {

    if (!drawingCanvas) {

        return;

    }


    clearDrawing();


    isDrawing =
        false;


    drawingCanvas.style.pointerEvents =
        "auto";

}


// ==============================
// AFFICHER LA CARTE
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


    const result =
        getQuestionAndAnswer(
            currentCard
        );


    questionElement.textContent =
        result.question;


    answerElement.textContent =
        result.answer;


    answerElement.classList.add(
        "hidden"
    );


    resultElement.textContent =
        "";


    /*
     * On cache toutes les zones
     * spécifiques aux modes.
     */

    writingArea.classList.add(
        "hidden"
    );


    if (drawingArea) {

        drawingArea.classList.add(
            "hidden"
        );

    }


    if (referenceDrawingElement) {

        referenceDrawingElement.classList.add(
            "hidden"
        );

        referenceDrawingElement.removeAttribute(
            "src"
        );

    }


    /*
     * MODE ÉCRITURE
     */

    if (
        mode === "writing"
    ) {

        writingArea.classList.remove(
            "hidden"
        );


        answerInput.value =
            "";


        answerInput.focus();

    }


    /*
     * MODE DESSIN
     */

    if (
        mode === "drawing"
    ) {

        if (!drawingArea) {

            console.error(
                "La zone de dessin est absente de flashcards.html."
            );

        } else {

            drawingArea.classList.remove(
                "hidden"
            );


            resetDrawing();


            if (
                referenceDrawingElement &&
                currentCard.drawing
            ) {

                referenceDrawingElement.src =
                    currentCard.drawing;

            }

        }

    }


    /*
     * MODE FLASHCARD
     */

    if (
        mode === "flashcard"
    ) {

        writingArea.classList.add(
            "hidden"
        );

    }


    showArea.classList.remove(
        "hidden"
    );


    ratingArea.classList.add(
        "hidden"
    );


    skipButton.classList.remove(
        "hidden"
    );


    metaElement.textContent =
        `${selectedDeck.name} — ${queue.length} carte(s) restante(s)`;

}


// ==============================
// AFFICHER LA RÉPONSE
// ==============================

function showAnswer() {

    if (!currentCard) {

        return;

    }


    /*
     * En mode dessin, il n'y a pas de
     * texte de réponse : on affiche le
     * dessin de référence à la place.
     */

    if (
        mode === "drawing"
    ) {

        answerElement.classList.add(
            "hidden"
        );


        if (
            referenceDrawingElement &&
            currentCard.drawing
        ) {

            referenceDrawingElement.classList.remove(
                "hidden"
            );

        }

    } else {

        answerElement.classList.remove(
            "hidden"
        );

    }


    showArea.classList.add(
        "hidden"
    );


    /*
     * En mode dessin, on empêche
     * de continuer à modifier le dessin
     * après révélation.
     */

    if (
        mode === "drawing" &&
        drawingCanvas
    ) {

        drawingCanvas.style.pointerEvents =
            "none";

    }


    /*
     * En mode écriture, on vérifie
     * immédiatement la réponse.
     */

    if (
        mode === "writing"
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
// VÉRIFIER L'ÉCRITURE
// ==============================

function normalizeAnswer(
    text
) {

    return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

}


function checkWritingAnswer() {

    const userAnswer =
        normalizeAnswer(
            answerInput.value
        );


    const correctAnswer =
        normalizeAnswer(
            answerElement.textContent
        );


    if (
        userAnswer === correctAnswer
    ) {

        resultElement.textContent =
            "✓ Correct !";

    } else {

        resultElement.textContent =
            "✗ Incorrect.";

    }


    showWritingCorrectionButtons();

}


// ==============================
// BOUTONS DE CORRECTION ÉCRITURE
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
        .querySelector("#writing-again")
        .addEventListener(
            "click",
            () => {

                rateCard(
                    "again"
                );

            }
        );


    document
        .querySelector("#writing-good")
        .addEventListener(
            "click",
            () => {

                rateCard(
                    "good"
                );

            }
        );

}


// ==============================
// RESTAURER LES BOUTONS SRS
// ==============================

function restoreRatingButtons() {

    ratingArea.innerHTML = `

        <button
            id="again-button"
            data-rating="again"
        >
            Again
            <span id="again-delay"></span>
        </button>


        <button
            id="hard-button"
            data-rating="hard"
        >
            Hard
            <span id="hard-delay"></span>
        </button>


        <button
            id="good-button"
            data-rating="good"
        >
            Good
            <span id="good-delay"></span>
        </button>


        <button
            id="easy-button"
            data-rating="easy"
        >
            Easy
            <span id="easy-delay"></span>
        </button>

    `;


    document
        .querySelector("#again-button")
        .addEventListener(
            "click",
            () => rateCard("again")
        );


    document
        .querySelector("#hard-button")
        .addEventListener(
            "click",
            () => rateCard("hard")
        );


    document
        .querySelector("#good-button")
        .addEventListener(
            "click",
            () => rateCard("good")
        );


    document
        .querySelector("#easy-button")
        .addEventListener(
            "click",
            () => rateCard("easy")
        );

}


// ==============================
// FORMATAGE DU DÉLAI
// ==============================

function formatDelay(
    milliseconds
) {

    const minutes =
        Math.round(
            milliseconds /
            (60 * 1000)
        );


    if (
        minutes < 60
    ) {

        return `${Math.max(1, minutes)} min`;

    }


    const hours =
        Math.round(
            minutes / 60
        );


    if (
        hours < 24
    ) {

        return `${hours} h`;

    }


    const days =
        Math.round(
            hours / 24
        );


    return `${days} j`;

}


// ==============================
// CALCUL DU PROCHAIN DÉLAI
// ==============================

function getRatingDelay(
    rating
) {

    if (!currentCard) {

        return 0;

    }


    const now =
        Date.now();


    /*
     * NOUVELLE CARTE
     */

    if (
        currentCard.state === "new"
    ) {

        if (
            rating === "again"
        ) {

            return (
                defaultSettings.learningSteps[0] *
                60 *
                1000
            );

        }


        if (
            rating === "hard"
        ) {

            return (
                defaultSettings.learningSteps[0] *
                60 *
                1000
            );

        }


        if (
            rating === "good"
        ) {

            return (
                defaultSettings.graduatingInterval *
                24 *
                60 *
                60 *
                1000
            );

        }


        if (
            rating === "easy"
        ) {

            return (
                defaultSettings.easyInterval *
                24 *
                60 *
                60 *
                1000
            );

        }

    }


    /*
     * CARTE EN APPRENTISSAGE
     */

    if (
        currentCard.state === "learning"
    ) {

        if (
            rating === "again"
        ) {

            return (
                defaultSettings.learningSteps[0] *
                60 *
                1000
            );

        }


        if (
            rating === "hard"
        ) {

            return (
                defaultSettings.learningSteps[1] *
                60 *
                1000
            );

        }


        if (
            rating === "good"
        ) {

            return (
                defaultSettings.graduatingInterval *
                24 *
                60 *
                60 *
                1000
            );

        }


        if (
            rating === "easy"
        ) {

            return (
                defaultSettings.easyInterval *
                24 *
                60 *
                60 *
                1000
            );

        }

    }


    /*
     * CARTE EN RÉVISION
     */

    const interval =
        currentCard.interval ||
        1;


    if (
        rating === "again"
    ) {

        return (
            defaultSettings.learningSteps[0] *
            60 *
            1000
        );

    }


    if (
        rating === "hard"
    ) {

        return (
            interval *
            defaultSettings.hardFactor *
            24 *
            60 *
            60 *
            1000
        );

    }


    if (
        rating === "good"
    ) {

        return (
            interval *
            defaultSettings.goodFactor *
            24 *
            60 *
            60 *
            1000
        );

    }


    if (
        rating === "easy"
    ) {

        return (
            interval *
            defaultSettings.easyFactor *
            24 *
            60 *
            60 *
            1000
        );

    }


    return (
        interval *
        24 *
        60 *
        60 *
        1000
    );

}


// ==============================
// AFFICHER LES DÉLAIS
// ==============================

function displayButtonDelays() {

    if (!currentCard) {

        return;

    }


    restoreRatingButtons();


    const ratings = [
        "again",
        "hard",
        "good",
        "easy"
    ];


    ratings.forEach(
        rating => {

            const delay =
                getRatingDelay(
                    rating
                );


            const element =
                document.querySelector(
                    `#${rating}-delay`
                );


            if (element) {

                element.textContent =
                    `(${formatDelay(delay)})`;

            }

        }
    );

}


// ==============================
// PLANIFIER LA CARTE
// ==============================

function scheduleCard(
    rating
) {

    const now =
        Date.now();


    const delay =
        getRatingDelay(
            rating
        );


    /*
     * AGAIN
     */

    if (
        rating === "again"
    ) {

        currentCard.state =
            "learning";


        currentCard.step =
            0;


        currentCard.interval =
            1;


        currentCard.nextReview =
            now + delay;


        currentCard.reps =
            (currentCard.reps || 0) + 1;


        return;

    }


    /*
     * NOUVELLE CARTE
     */

    if (
        currentCard.state === "new"
    ) {

        if (
            rating === "good"
        ) {

            currentCard.state =
                "review";


            currentCard.interval =
                defaultSettings.graduatingInterval;

        }


        if (
            rating === "easy"
        ) {

            currentCard.state =
                "review";


            currentCard.interval =
                defaultSettings.easyInterval;

        }


        if (
            rating === "hard"
        ) {

            currentCard.state =
                "learning";


            currentCard.step =
                0;

        }


        currentCard.nextReview =
            now + delay;


        currentCard.reps =
            (currentCard.reps || 0) + 1;


        return;

    }


    /*
     * APPRENTISSAGE
     */

    if (
        currentCard.state === "learning"
    ) {

        if (
            rating === "good"
        ) {

            currentCard.state =
                "review";


            currentCard.interval =
                defaultSettings.graduatingInterval;

        }


        if (
            rating === "easy"
        ) {

            currentCard.state =
                "review";


            currentCard.interval =
                defaultSettings.easyInterval;

        }


        if (
            rating === "hard"
        ) {

            currentCard.state =
                "learning";

        }


        currentCard.nextReview =
            now + delay;


        currentCard.reps =
            (currentCard.reps || 0) + 1;


        return;

    }


    /*
     * RÉVISION
     */

    currentCard.state =
        "review";


    if (
        rating === "hard"
    ) {

        currentCard.interval =
            Math.max(
                1,
                Math.round(
                    (
                        currentCard.interval ||
                        1
                    ) *
                    defaultSettings.hardFactor
                )
            );

    }


    if (
        rating === "good"
    ) {

        currentCard.interval =
            Math.max(
                1,
                Math.round(
                    (
                        currentCard.interval ||
                        1
                    ) *
                    defaultSettings.goodFactor
                )
            );

    }


    if (
        rating === "easy"
    ) {

        currentCard.interval =
            Math.max(
                1,
                Math.round(
                    (
                        currentCard.interval ||
                        1
                    ) *
                    defaultSettings.easyFactor
                )
            );

    }


    currentCard.nextReview =
        now + delay;


    currentCard.reps =
        (currentCard.reps || 0) + 1;

}


// ==============================
// NOTER LA CARTE
// ==============================

function rateCard(
    rating
) {

    if (!currentCard) {

        return;

    }


    const cardBeingRated =
        currentCard;


    const previousCardState = {

        level:
            cardBeingRated.level,

        interval:
            cardBeingRated.interval,

        nextReview:
            cardBeingRated.nextReview,

        reps:
            cardBeingRated.reps,

        state:
            cardBeingRated.state,

        step:
            cardBeingRated.step

    };


    const previousQueue =
        [...queue];


    scheduleCard(
        rating
    );


    saveDecks(
        decks
    );


    /*
     * On retire la carte de la file.
     */

    queue.shift();


    /*
     * Si la carte doit revenir
     * rapidement, on la remet dans
     * la file pour cette session.
     */

    if (
        rating === "again"
    ) {

        queue.push(
            currentCard
        );

    }


    lastAction = {

        card:
            cardBeingRated,

        previousState:
            previousCardState,

        previousQueue:
            previousQueue

    };


    showUndoButton();


    currentCard =
        null;


    displayCard();

}


// ==============================
// ANNULER LA DERNIÈRE RÉPONSE
// ==============================

function showUndoButton() {

    if (undoButton) {

        undoButton.classList.remove(
            "hidden"
        );

    }

}


function hideUndoButton() {

    if (undoButton) {

        undoButton.classList.add(
            "hidden"
        );

    }

}


function undoLastRating() {

    if (!lastAction) {

        return;

    }


    Object.assign(
        lastAction.card,
        lastAction.previousState
    );


    queue =
        lastAction.previousQueue;


    lastAction =
        null;


    saveDecks(
        decks
    );


    hideUndoButton();


    displayCard();

}


// ==============================
// PASSER UNE CARTE
// ==============================

function skipCard() {

    if (
        queue.length <= 1
    ) {

        return;

    }


    const skippedCard =
        queue.shift();


    queue.push(
        skippedCard
    );


    displayCard();

}


// ==============================
// FIN DE SESSION
// ==============================

function finishSession() {

    questionElement.textContent =
        "";


    answerElement.classList.add(
        "hidden"
    );


    writingArea.classList.add(
        "hidden"
    );


    if (drawingArea) {

        drawingArea.classList.add(
            "hidden"
        );

    }


    if (referenceDrawingElement) {

        referenceDrawingElement.classList.add(
            "hidden"
        );

    }


    showArea.classList.add(
        "hidden"
    );


    ratingArea.classList.add(
        "hidden"
    );


    skipButton.classList.add(
        "hidden"
    );


    hideUndoButton();


    lastAction =
        null;


    completionElement.classList.remove(
        "hidden"
    );


    metaElement.textContent =
        "Session terminée.";

}


// ==============================
// RACCOURCIS CLAVIER
// ==============================

document.addEventListener(
    "keydown",
    event => {

        /*
         * Les raccourcis ne sont actifs
         * que pour le mode flashcard.
         */

        if (
            mode !== "flashcard"
        ) {

            return;

        }


        if (
            event.key === " " &&
            !event.target.matches(
                "input, textarea"
            )
        ) {

            event.preventDefault();

            showAnswer();

        }


        if (
            event.key === "1"
        ) {

            rateCard(
                "again"
            );

        }


        if (
            event.key === "2"
        ) {

            rateCard(
                "hard"
            );

        }


        if (
            event.key === "3"
        ) {

            rateCard(
                "good"
            );

        }


        if (
            event.key === "4"
        ) {

            rateCard(
                "easy"
            );

        }

    }
);


// ==============================
// BOUTONS PRINCIPAUX
// ==============================

showAnswerButton.addEventListener(
    "click",
    showAnswer
);


skipButton.addEventListener(
    "click",
    skipCard
);


// ==============================
// BOUTON ANNULER
// ==============================

if (undoButton) {

    undoButton.addEventListener(
        "click",
        undoLastRating
    );

}


// ==============================
// BOUTON EFFACER DESSIN
// ==============================

if (clearDrawingButton) {

    clearDrawingButton.addEventListener(
        "click",
        clearDrawing
    );

}


// ==============================
// ÉVÉNEMENTS DU CANVAS
// ==============================

if (drawingCanvas) {

    drawingCanvas.addEventListener(
        "pointerdown",
        startDrawing
    );


    drawingCanvas.addEventListener(
        "pointermove",
        draw
    );


    drawingCanvas.addEventListener(
        "pointerup",
        stopDrawing
    );


    drawingCanvas.addEventListener(
        "pointercancel",
        stopDrawing
    );

}


// ==============================
// INITIALISATION
// ==============================

queue =
    buildQueue();


restoreRatingButtons();


displayCard();