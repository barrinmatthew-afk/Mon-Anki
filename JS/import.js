const decks = JSON.parse(localStorage.getItem("decks")) || [];

const deckSelect = document.getElementById("deck-select");
const cardsTable = document.getElementById("cards-table");
const imageInput = document.getElementById("image-input");
const ocrButton = document.getElementById("ocr-button");
const addRowButton = document.getElementById("add-row");
const createCardsButton = document.getElementById("create-cards");
const statusElement = document.getElementById("status");



function saveDecks() {

    localStorage.setItem(
        "decks",
        JSON.stringify(decks)
    );

}



function populateDeckSelect() {

    deckSelect.innerHTML = "";

    decks.forEach(deck => {

        const option = document.createElement("option");

        option.value = deck.name;

        option.textContent = deck.name;

        deckSelect.appendChild(option);

    });


    const selectedDeck = localStorage.getItem("selectedDeck");

    if (selectedDeck) {

        const exists = decks.some(
            deck => deck.name === selectedDeck
        );

        if (exists) {

            deckSelect.value = selectedDeck;

        }

    }

}



function createDrawingCanvas() {

    const wrapper = document.createElement("div");

    wrapper.className = "drawing-answer";


    const canvas = document.createElement("canvas");

    canvas.width = 700;

    canvas.height = 360;


    const clearButton = document.createElement("button");

    clearButton.type = "button";

    clearButton.textContent = "Effacer";


    wrapper.appendChild(canvas);

    wrapper.appendChild(clearButton);


    const context = canvas.getContext("2d");


    context.lineWidth = 4;

    context.lineCap = "round";

    context.lineJoin = "round";

    context.strokeStyle = "#222";


    let drawing = false;


    function getPosition(event) {

        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;

        const scaleY = canvas.height / rect.height;


        return {

            x: (event.clientX - rect.left) * scaleX,

            y: (event.clientY - rect.top) * scaleY

        };

    }


    canvas.addEventListener(
        "pointerdown",
        event => {

            drawing = true;

            canvas.setPointerCapture(event.pointerId);

            const position = getPosition(event);

            context.beginPath();

            context.moveTo(
                position.x,
                position.y
            );

        }
    );


    canvas.addEventListener(
        "pointermove",
        event => {

            if (!drawing) {

                return;

            }


            const position = getPosition(event);


            context.lineTo(
                position.x,
                position.y
            );

            context.stroke();

        }
    );


    function stopDrawing(event) {

        drawing = false;

        if (
            event.pointerId !== undefined &&
            canvas.hasPointerCapture(event.pointerId)
        ) {

            canvas.releasePointerCapture(event.pointerId);

        }

    }


    canvas.addEventListener(
        "pointerup",
        stopDrawing
    );


    canvas.addEventListener(
        "pointercancel",
        stopDrawing
    );


    clearButton.addEventListener(
        "click",
        () => {

            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

        }
    );


    wrapper.getDrawingData = function () {

        return canvas.toDataURL("image/png");

    };


    return wrapper;

}



function addRow(
    question = "",
    answer = "",
    cardMode = "text"
) {

    const emptyRow = document.getElementById("empty-row");

    if (emptyRow) {

        emptyRow.remove();

    }


    const row = document.createElement("tr");


    const questionCell = document.createElement("td");

    const questionInput = document.createElement("input");

    questionInput.type = "text";

    questionInput.className = "question-input";

    questionInput.placeholder = "Question";

    questionInput.value = question;

    questionCell.appendChild(questionInput);



    const transferCell = document.createElement("td");

    const transferInput = document.createElement("input");

    transferInput.type = "text";

    transferInput.className = "transfer-input";

    transferInput.placeholder = "Optionnel";

    transferCell.appendChild(transferInput);



    const answerCell = document.createElement("td");

    answerCell.className = "answer-cell";


    const typeCell = document.createElement("td");

    typeCell.className = "type-cell";


    const typeSelect = document.createElement("select");

    typeSelect.className = "type-select";


    const textOption = document.createElement("option");

    textOption.value = "text";

    textOption.textContent = "Texte";


    const drawingOption = document.createElement("option");

    drawingOption.value = "drawing";

    drawingOption.textContent = "✏️ Dessin";


    typeSelect.appendChild(textOption);

    typeSelect.appendChild(drawingOption);


    typeSelect.value = cardMode;


    typeCell.appendChild(typeSelect);



    const deleteCell = document.createElement("td");

    deleteCell.className = "delete-cell";


    const deleteButton = document.createElement("button");

    deleteButton.type = "button";

    deleteButton.className = "delete-button";

    deleteButton.textContent = "Supprimer";


    deleteCell.appendChild(deleteButton);



    let drawingWrapper = null;


    function displayTextAnswer() {

        answerCell.innerHTML = "";


        const answerInput = document.createElement("input");

        answerInput.type = "text";

        answerInput.className = "answer-input";

        answerInput.placeholder = "Réponse";

        answerInput.value = answer;


        answerCell.appendChild(answerInput);


        drawingWrapper = null;

    }



    function displayDrawingAnswer() {

        answerCell.innerHTML = "";


        drawingWrapper = createDrawingCanvas();


        answerCell.appendChild(drawingWrapper);

    }



    typeSelect.addEventListener(
        "change",
        () => {

            if (typeSelect.value === "drawing") {

                displayDrawingAnswer();

            } else {

                displayTextAnswer();

            }

        }
    );



    deleteButton.addEventListener(
        "click",
        () => {

            row.remove();


            if (cardsTable.children.length === 0) {

                addEmptyMessage();

            }

        }
    );



    row.appendChild(questionCell);

    row.appendChild(transferCell);

    row.appendChild(answerCell);

    row.appendChild(typeCell);

    row.appendChild(deleteCell);


    cardsTable.appendChild(row);


    if (cardMode === "drawing") {

        displayDrawingAnswer();

    } else {

        displayTextAnswer();

    }

}



function addEmptyMessage() {

    const row = document.createElement("tr");

    row.id = "empty-row";


    const cell = document.createElement("td");

    cell.colSpan = 5;

    cell.className = "empty-message";

    cell.textContent = "Aucune carte pour le moment.";


    row.appendChild(cell);

    cardsTable.appendChild(row);

}



function getRows() {

    return Array.from(
        cardsTable.querySelectorAll("tr")
    ).filter(
        row => row.id !== "empty-row"
    );

}



function recognizeImage(file) {

    if (!file) {

        return;

    }


    statusElement.textContent =
        "OCR en cours...";


    Tesseract.recognize(
        file,
        "fra+nld",
        {

            logger: message => {

                if (
                    message.status === "recognizing text" &&
                    typeof message.progress === "number"
                ) {

                    const percentage =
                        Math.round(
                            message.progress * 100
                        );

                    statusElement.textContent =
                        `OCR en cours... ${percentage}%`;

                }

            }

        }
    )
        .then(result => {

            const text =
                result.data.text.trim();


            statusElement.textContent =
                "OCR terminé.";


            if (!text) {

                alert(
                    "Aucun texte n'a été détecté."
                );

                return;

            }


            const lines = text
                .split("\n")
                .map(
                    line => line.trim()
                )
                .filter(
                    line => line.length > 0
                );


            lines.forEach(line => {

                addRow(
                    line,
                    "",
                    "text"
                );

            });

        })
        .catch(error => {

            console.error(error);

            statusElement.textContent =
                "Erreur pendant l'OCR.";

            alert(
                "Une erreur est survenue pendant l'OCR."
            );

        });

}



function createCards() {

    const selectedDeckName =
        deckSelect.value;


    const selectedDeck =
        decks.find(
            deck =>
                deck.name === selectedDeckName
        );


    if (!selectedDeck) {

        alert(
            "Aucun deck sélectionné."
        );

        return;

    }


    const rows = getRows();


    if (rows.length === 0) {

        alert(
            "Aucune carte à créer."
        );

        return;

    }


    const newCards = [];


    for (const row of rows) {

        const questionInput =
            row.querySelector(
                ".question-input"
            );


        const transferInput =
            row.querySelector(
                ".transfer-input"
            );


        const typeSelect =
            row.querySelector(
                ".type-select"
            );


        const question =
            questionInput.value.trim();


        const transfer =
            transferInput.value.trim();


        const cardMode =
            typeSelect.value;


        if (!question) {

            continue;

        }


        let answer = "";

        let drawing = "";


        if (cardMode === "drawing") {

            const drawingWrapper =
                row.querySelector(
                    ".drawing-answer"
                );


            if (drawingWrapper) {

                drawing =
                    drawingWrapper.getDrawingData();

            }

        } else {

            const answerInput =
                row.querySelector(
                    ".answer-input"
                );


            if (answerInput) {

                answer =
                    answerInput.value.trim();

            }

        }


        if (
            cardMode === "text" &&
            !answer
        ) {

            continue;

        }


        newCards.push({

            word: question,

            answer: answer,

            transfer: transfer,

            mode: cardMode,

            drawing: drawing,

            level: 0,

            interval: 1,

            nextReview: 0

        });

    }


    if (newCards.length === 0) {

        alert(
            "Aucune carte valide à créer."
        );

        return;

    }


    selectedDeck.cards.push(
        ...newCards
    );


    saveDecks();


    localStorage.setItem(
        "selectedDeck",
        selectedDeck.name
    );


    alert(
        `${newCards.length} carte(s) créée(s).`
    );


    cardsTable.innerHTML = "";

    addEmptyMessage();

}



addRowButton.addEventListener(
    "click",
    () => {

        addRow();

    }
);



ocrButton.addEventListener(
    "click",
    () => {

        if (!imageInput.files.length) {

            alert(
                "Choisis d'abord une image."
            );

            return;

        }


        recognizeImage(
            imageInput.files[0]
        );

    }
);



createCardsButton.addEventListener(
    "click",
    createCards
);



deckSelect.addEventListener(
    "change",
    () => {

        localStorage.setItem(
            "selectedDeck",
            deckSelect.value
        );

    }
);



populateDeckSelect();