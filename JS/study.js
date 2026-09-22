// ==============================
// CHARGER LES DECKS
// ==============================

function loadDecks() {
    const saved = localStorage.getItem("decks");

    if (!saved) {
        return [];
    }

    try {
        return JSON.parse(saved);
    } catch (error) {
        console.error(
            "Erreur lors du chargement des decks :",
            error
        );

        return [];
    }
}


// ==============================
// DECK SÉLECTIONNÉ
// ==============================

const selectedDeckName =
    localStorage.getItem("selectedDeck");

const decks =
    loadDecks();

const deck =
    decks.find(
        currentDeck =>
            currentDeck.name === selectedDeckName
    );


// ==============================
// VÉRIFICATION
// ==============================

if (!deck) {

    alert("Deck introuvable.");

    window.location.href =
        "index.html";

    throw new Error(
        "Deck introuvable"
    );

}


// ==============================
// AFFICHER LE DECK
// ==============================

const deckNameElement =
    document.querySelector("#deck-name");

if (deckNameElement) {

    deckNameElement.textContent =
        `${deck.name} — ${deck.cards.length} carte(s)`;

}


// ==============================
// PARAMÈTRES
// ==============================

let direction =
    localStorage.getItem("selectedDirection") ||
    "random";


let mode =
    localStorage.getItem("selectedMode") ||
    "flashcard";


// ==============================
// LIMITES
// ==============================

let newCardLimit =
    Number(
        localStorage.getItem("newCardLimit") ||
        20
    );


let reviewLimit =
    Number(
        localStorage.getItem("reviewLimit") ||
        50
    );


// ==============================
// BOUTONS
// ==============================

const frNlButton =
    document.querySelector("#fr-nl");

const nlFrButton =
    document.querySelector("#nl-fr");

const randomDirectionButton =
    document.querySelector("#random-direction");

const flashcardButton =
    document.querySelector("#flashcard-mode");

const writingButton =
    document.querySelector("#writing-mode");

const drawingButton =
    document.querySelector("#drawing-mode");

const startButton =
    document.querySelector("#start-button");


// ==============================
// LIMITES HTML
// ==============================

const newCardLimitInput =
    document.querySelector("#new-card-limit");

const reviewLimitInput =
    document.querySelector("#review-limit");

const availableCardsElement =
    document.querySelector("#available-cards");


if (newCardLimitInput) {

    newCardLimitInput.value =
        newCardLimit;

}


if (reviewLimitInput) {

    reviewLimitInput.value =
        reviewLimit;

}


// ==============================
// CARTES DISPONIBLES
// ==============================

function updateAvailableCards() {

    if (!availableCardsElement) {
        return;
    }


    const now =
        Date.now();


    const newCards =
        deck.cards.filter(
            card =>
                !card.state ||
                card.state === "new"
        );


    const learningCards =
        deck.cards.filter(
            card =>
                card.state === "learning" &&
                card.nextReview &&
                card.nextReview <= now
        );


    const reviewCards =
        deck.cards.filter(
            card =>
                card.state === "review" &&
                card.nextReview &&
                card.nextReview <= now
        );


    availableCardsElement.innerHTML =
        `
        <strong>${newCards.length}</strong>
        nouvelle(s) carte(s)<br>

        <strong>${learningCards.length}</strong>
        carte(s) en apprentissage due(s)<br>

        <strong>${reviewCards.length}</strong>
        révision(s) due(s)
        `;

}


// ==============================
// SÉLECTION
// ==============================

function updateSelection() {

    const buttons = [

        frNlButton,
        nlFrButton,
        randomDirectionButton,
        flashcardButton,
        writingButton,
        drawingButton

    ];


    buttons.forEach(button => {

        if (button) {

            button.classList.remove(
                "selected"
            );

        }

    });


    if (
        direction === "fr-nl" &&
        frNlButton
    ) {

        frNlButton.classList.add(
            "selected"
        );

    }


    if (
        direction === "nl-fr" &&
        nlFrButton
    ) {

        nlFrButton.classList.add(
            "selected"
        );

    }


    if (
        direction === "random" &&
        randomDirectionButton
    ) {

        randomDirectionButton.classList.add(
            "selected"
        );

    }


    if (
        mode === "flashcard" &&
        flashcardButton
    ) {

        flashcardButton.classList.add(
            "selected"
        );

    }


    if (
        mode === "writing" &&
        writingButton
    ) {

        writingButton.classList.add(
            "selected"
        );

    }


    if (
        mode === "drawing" &&
        drawingButton
    ) {

        drawingButton.classList.add(
            "selected"
        );

    }

}


// ==============================
// DIRECTION
// ==============================

if (frNlButton) {

    frNlButton.addEventListener(
        "click",
        () => {

            direction =
                "fr-nl";

            updateSelection();

        }
    );

}


if (nlFrButton) {

    nlFrButton.addEventListener(
        "click",
        () => {

            direction =
                "nl-fr";

            updateSelection();

        }
    );

}


if (randomDirectionButton) {

    randomDirectionButton.addEventListener(
        "click",
        () => {

            direction =
                "random";

            updateSelection();

        }
    );

}


// ==============================
// MODE
// ==============================

if (flashcardButton) {

    flashcardButton.addEventListener(
        "click",
        () => {

            mode =
                "flashcard";

            updateSelection();

        }
    );

}


if (writingButton) {

    writingButton.addEventListener(
        "click",
        () => {

            mode =
                "writing";

            updateSelection();

        }
    );

}


if (drawingButton) {

    drawingButton.addEventListener(
        "click",
        () => {

            mode =
                "drawing";

            updateSelection();

        }
    );

}


// ==============================
// LIMITES
// ==============================

if (newCardLimitInput) {

    newCardLimitInput.addEventListener(
        "input",
        () => {

            let value =
                Number(
                    newCardLimitInput.value
                );


            if (
                !Number.isFinite(value) ||
                value < 0
            ) {

                value = 0;

            }


            newCardLimit =
                Math.floor(value);

        }
    );

}


if (reviewLimitInput) {

    reviewLimitInput.addEventListener(
        "input",
        () => {

            let value =
                Number(
                    reviewLimitInput.value
                );


            if (
                !Number.isFinite(value) ||
                value < 0
            ) {

                value = 0;

            }


            reviewLimit =
                Math.floor(value);

        }
    );

}


// ==============================
// COMMENCER
// ==============================

if (startButton) {

    startButton.addEventListener(
        "click",
        () => {

            localStorage.setItem(
                "selectedDirection",
                direction
            );


            localStorage.setItem(
                "selectedMode",
                mode
            );


            localStorage.setItem(
                "newCardLimit",
                String(newCardLimit)
            );


            localStorage.setItem(
                "reviewLimit",
                String(reviewLimit)
            );


            window.location.href =
                "flashcards.html";

        }
    );

}


// ==============================
// INITIALISATION
// ==============================

updateSelection();

updateAvailableCards();