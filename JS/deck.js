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


function saveDecks(decks) {

    localStorage.setItem(
        "decks",
        JSON.stringify(decks)
    );


    /*
     * IMPORTANT :
     *
     * On sauvegarde maintenant aussi dans Firestore.
     *
     * firebase.js expose cette fonction sur window.
     */

    if (window.saveDecksToCloud) {

        window.saveDecksToCloud(
            decks
        ).catch(error => {

            console.error(
                "Impossible de sauvegarder les modifications dans Firestore :",
                error
            );

        });

    }

}


const decks =
    loadDecks();


const deckName =
    localStorage.getItem(
        "manageDeckName"
    );


const deck =
    decks.find(
        currentDeck =>
            currentDeck.name === deckName
    );


const titleElement =
    document.getElementById(
        "deck-title"
    );


const subtitleElement =
    document.getElementById(
        "deck-subtitle"
    );


const cardsTable =
    document.getElementById(
        "cards-table"
    );


const newQuestionInput =
    document.getElementById(
        "new-question"
    );


const newAnswerInput =
    document.getElementById(
        "new-answer"
    );


const addCardButton =
    document.getElementById(
        "add-card-button"
    );


const syncStatus =
    document.getElementById(
        "sync-status"
    );


if (!deck) {

    alert(
        "Deck introuvable."
    );


    window.location.href =
        "index.html";

}


/* =========================
   REDIMENSIONNER UNE IMAGE
========================= */

function resizeImageToDataURL(
    file,
    maxDimension,
    callback
) {

    const reader =
        new FileReader();


    reader.onload = function () {

        const image =
            new Image();


        image.onload = function () {

            let width =
                image.width;


            let height =
                image.height;


            if (
                width > maxDimension ||
                height > maxDimension
            ) {

                if (width > height) {

                    height =
                        Math.round(
                            height *
                            (
                                maxDimension /
                                width
                            )
                        );


                    width =
                        maxDimension;

                } else {

                    width =
                        Math.round(
                            width *
                            (
                                maxDimension /
                                height
                            )
                        );


                    height =
                        maxDimension;

                }

            }


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                width;


            canvas.height =
                height;


            const context =
                canvas.getContext(
                    "2d"
                );


            context.fillStyle =
                "white";


            context.fillRect(
                0,
                0,
                width,
                height
            );


            context.drawImage(
                image,
                0,
                0,
                width,
                height
            );


            callback(
                canvas.toDataURL(
                    "image/jpeg",
                    0.85
                )
            );

        };


        image.src =
            reader.result;

    };


    reader.readAsDataURL(
        file
    );

}


/* =========================
   MESSAGE VIDE
========================= */

function renderEmptyMessage() {

    cardsTable.innerHTML = `

        <tr id="empty-row">

            <td
                colspan="4"
                class="empty-message"
            >

                Ce deck ne contient aucune carte.

            </td>

        </tr>

    `;

}


/* =========================
   AFFICHER LES CARTES
========================= */

function renderCards() {

    cardsTable.innerHTML = "";


    if (
        deck.cards.length === 0
    ) {

        renderEmptyMessage();

        return;

    }


    deck.cards.forEach(
        card => {

            const row =
                document.createElement(
                    "tr"
                );


            /* =========================
               QUESTION
            ========================= */

            const questionCell =
                document.createElement(
                    "td"
                );


            const questionInput =
                document.createElement(
                    "input"
                );


            questionInput.type =
                "text";


            questionInput.value =
                card.word || "";


            questionCell.appendChild(
                questionInput
            );


            /* =========================
               REPONSE
            ========================= */

            const answerCell =
                document.createElement(
                    "td"
                );


            let answerInput =
                null;


            let pendingDrawing =
                card.drawing || "";


            if (
                card.mode === "drawing"
            ) {

                const wrapper =
                    document.createElement(
                        "div"
                    );


                wrapper.className =
                    "drawing-cell";


                const preview =
                    document.createElement(
                        "img"
                    );


                preview.src =
                    card.drawing || "";


                wrapper.appendChild(
                    preview
                );


                const replaceButton =
                    document.createElement(
                        "button"
                    );


                replaceButton.type =
                    "button";


                replaceButton.textContent =
                    "📁 Remplacer l'image";


                wrapper.appendChild(
                    replaceButton
                );


                const fileInput =
                    document.createElement(
                        "input"
                    );


                fileInput.type =
                    "file";


                fileInput.accept =
                    "image/*";


                fileInput.style.display =
                    "none";


                wrapper.appendChild(
                    fileInput
                );


                replaceButton.addEventListener(
                    "click",
                    () =>
                        fileInput.click()
                );


                fileInput.addEventListener(
                    "change",
                    () => {

                        const file =
                            fileInput.files[0];


                        if (!file) {

                            return;

                        }


                        resizeImageToDataURL(
                            file,
                            1000,
                            dataURL => {

                                pendingDrawing =
                                    dataURL;


                                preview.src =
                                    dataURL;

                            }
                        );

                    }
                );


                answerCell.appendChild(
                    wrapper
                );

            } else {

                answerInput =
                    document.createElement(
                        "input"
                    );


                answerInput.type =
                    "text";


                answerInput.value =
                    card.answer || "";


                answerCell.appendChild(
                    answerInput
                );

            }


            /* =========================
               TYPE
            ========================= */

            const typeCell =
                document.createElement(
                    "td"
                );


            typeCell.className =
                "type-cell";


            typeCell.textContent =
                card.mode === "drawing"
                    ? "✏️ Dessin"
                    : "Texte";


            /* =========================
               ACTIONS
            ========================= */

            const actionsCell =
                document.createElement(
                    "td"
                );


            actionsCell.className =
                "actions-cell";


            const saveButton =
                document.createElement(
                    "button"
                );


            saveButton.type =
                "button";


            saveButton.className =
                "save-button";


            saveButton.textContent =
                "Enregistrer";


            const statusSpan =
                document.createElement(
                    "span"
                );


            statusSpan.className =
                "row-status";


            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.type =
                "button";


            deleteButton.className =
                "delete-button";


            deleteButton.textContent =
                "Supprimer";


            /* =========================
               ENREGISTRER
            ========================= */

            saveButton.addEventListener(
                "click",
                () => {

                    card.word =
                        questionInput.value.trim();


                    if (
                        card.mode === "drawing"
                    ) {

                        card.drawing =
                            pendingDrawing;

                    } else {

                        card.answer =
                            answerInput.value.trim();

                    }


                    saveDecks(
                        decks
                    );


                    statusSpan.textContent =
                        "✓ Enregistré";


                    syncStatus.textContent =
                        "✓ Modification synchronisée.";


                    setTimeout(
                        () => {

                            statusSpan.textContent =
                                "";

                        },
                        1500
                    );

                }
            );


            /* =========================
               SUPPRIMER
            ========================= */

            deleteButton.addEventListener(
                "click",
                () => {

                    const confirmation =
                        confirm(
                            "Supprimer cette carte ?"
                        );


                    if (!confirmation) {

                        return;

                    }


                    const index =
                        deck.cards.indexOf(
                            card
                        );


                    if (index !== -1) {

                        deck.cards.splice(
                            index,
                            1
                        );

                    }


                    saveDecks(
                        decks
                    );


                    renderCards();

                    updateSubtitle();


                    syncStatus.textContent =
                        "✓ Carte supprimée et synchronisée.";

                }
            );


            actionsCell.appendChild(
                saveButton
            );


            actionsCell.appendChild(
                statusSpan
            );


            actionsCell.appendChild(
                deleteButton
            );


            row.appendChild(
                questionCell
            );


            row.appendChild(
                answerCell
            );


            row.appendChild(
                typeCell
            );


            row.appendChild(
                actionsCell
            );


            cardsTable.appendChild(
                row
            );

        }
    );

}


/* =========================
   AJOUTER UNE CARTE
========================= */

function addCard() {

    const question =
        newQuestionInput.value.trim();


    const answer =
        newAnswerInput.value.trim();


    if (!question) {

        alert(
            "Entre une question."
        );

        return;

    }


    if (!answer) {

        alert(
            "Entre une réponse."
        );

        return;

    }


    deck.cards.push({

        word: question,

        answer: answer,

        mode: "text",

        level: 0,

        interval: 1,

        nextReview: 0

    });


    saveDecks(
        decks
    );


    newQuestionInput.value =
        "";


    newAnswerInput.value =
        "";


    renderCards();

    updateSubtitle();


    syncStatus.textContent =
        "✓ Nouvelle carte ajoutée et synchronisée.";

}


/* =========================
   NOMBRE DE CARTES
========================= */

function updateSubtitle() {

    subtitleElement.textContent =
        `${deck.cards.length} carte(s)`;

}


/* =========================
   INITIALISATION
========================= */

titleElement.textContent =
    deck.name;


updateSubtitle();

renderCards();


/* =========================
   BOUTON AJOUTER
========================= */

if (addCardButton) {

    addCardButton.addEventListener(
        "click",
        addCard
    );

}


if (newAnswerInput) {

    newAnswerInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                addCard();

            }

        }
    );

}