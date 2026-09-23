const decks = JSON.parse(localStorage.getItem("decks")) || [];

const deckSelect = document.getElementById("deck-select");
const cardsTable = document.getElementById("cards-table");
const imageInput = document.getElementById("image-input");
const ocrButton = document.getElementById("ocr-button");
const createCardsButton = document.getElementById("create-cards");
const statusElement = document.getElementById("status");


/*
 * Ligne fixe, toujours en bas du tableau,
 * qui sert à ajouter une nouvelle carte
 * juste à la suite de la dernière ajoutée.
 */

let addRowControlRow = null;



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



function resizeImageToDataURL(
    file,
    maxDimension,
    callback
) {

    const reader = new FileReader();


    reader.onload = function () {

        const image = new Image();


        image.onload = function () {

            let width = image.width;

            let height = image.height;


            if (
                width > maxDimension ||
                height > maxDimension
            ) {

                if (width > height) {

                    height =
                        Math.round(
                            height * (maxDimension / width)
                        );

                    width = maxDimension;

                } else {

                    width =
                        Math.round(
                            width * (maxDimension / height)
                        );

                    height = maxDimension;

                }

            }


            const canvas =
                document.createElement("canvas");

            canvas.width = width;

            canvas.height = height;


            const context =
                canvas.getContext("2d");

            /*
             * Fond blanc : évite un fond
             * transparent qui deviendrait noir
             * une fois converti en JPEG.
             */

            context.fillStyle = "white";

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


        image.src = reader.result;

    };


    reader.readAsDataURL(file);

}



function createDrawingAnswer() {

    const wrapper = document.createElement("div");

    wrapper.className = "drawing-answer";


    /*
     * Deux façons de fournir le dessin :
     * - le dessiner ici à la souris/au doigt
     * - importer une photo/scan d'un dessin
     *   déjà fait sur papier
     */

    const modeButtons =
        document.createElement("div");

    modeButtons.className =
        "drawing-mode-buttons";


    const drawModeButton =
        document.createElement("button");

    drawModeButton.type = "button";

    drawModeButton.textContent =
        "✏️ Dessiner ici";

    drawModeButton.className =
        "drawing-mode-button selected";


    const uploadModeButton =
        document.createElement("button");

    uploadModeButton.type = "button";

    uploadModeButton.textContent =
        "📁 Importer une image";

    uploadModeButton.className =
        "drawing-mode-button";


    modeButtons.appendChild(drawModeButton);

    modeButtons.appendChild(uploadModeButton);


    /* --- Zone dessin à la souris --- */

    const canvasArea =
        document.createElement("div");

    canvasArea.className =
        "canvas-draw-area";


    const canvas =
        document.createElement("canvas");

    canvas.width = 700;

    canvas.height = 360;


    const clearButton =
        document.createElement("button");

    clearButton.type = "button";

    clearButton.textContent = "Effacer";


    canvasArea.appendChild(canvas);

    canvasArea.appendChild(clearButton);


    /* --- Zone import d'image --- */

    const uploadArea =
        document.createElement("div");

    uploadArea.className =
        "upload-draw-area hidden";


    const fileInput =
        document.createElement("input");

    fileInput.type = "file";

    fileInput.accept = "image/*";


    const preview =
        document.createElement("img");

    preview.className =
        "drawing-preview hidden";


    uploadArea.appendChild(fileInput);

    uploadArea.appendChild(preview);


    wrapper.appendChild(modeButtons);

    wrapper.appendChild(canvasArea);

    wrapper.appendChild(uploadArea);


    /* --- Logique dessin à la souris --- */

    const context =
        canvas.getContext("2d");


    context.lineWidth = 4;

    context.lineCap = "round";

    context.lineJoin = "round";

    context.strokeStyle = "#222";


    let drawing = false;

    let currentSubMode = "draw";

    let uploadedDataURL = "";


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


    /* --- Bascule entre les deux sous-modes --- */

    function selectDrawMode() {

        currentSubMode = "draw";

        drawModeButton.classList.add("selected");

        uploadModeButton.classList.remove("selected");

        canvasArea.classList.remove("hidden");

        uploadArea.classList.add("hidden");

    }


    function selectUploadMode() {

        currentSubMode = "upload";

        uploadModeButton.classList.add("selected");

        drawModeButton.classList.remove("selected");

        uploadArea.classList.remove("hidden");

        canvasArea.classList.add("hidden");

    }


    drawModeButton.addEventListener(
        "click",
        selectDrawMode
    );


    uploadModeButton.addEventListener(
        "click",
        selectUploadMode
    );


    /* --- Import d'une image existante --- */

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

                    uploadedDataURL = dataURL;

                    preview.src = dataURL;

                    preview.classList.remove("hidden");

                }
            );

        }
    );


    wrapper.getDrawingData = function () {

        if (currentSubMode === "upload") {

            return uploadedDataURL;

        }


        return canvas.toDataURL("image/png");

    };


    return wrapper;

}



function createAddRowControlRow() {

    const row = document.createElement("tr");

    row.id = "add-row-control";


    const cell = document.createElement("td");

    cell.colSpan = 5;

    cell.className = "add-row-cell";


    const button = document.createElement("button");

    button.type = "button";

    button.textContent =
        "➕ Ajouter une ligne";


    button.addEventListener(
        "click",
        () => {

            addRow();

        }
    );


    cell.appendChild(button);

    row.appendChild(cell);


    return row;

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

    transferCell.className = "transfer-cell";

    const transferButton = document.createElement("button");

    transferButton.type = "button";

    transferButton.className = "transfer-button";

    transferButton.title = "Échanger la question et la réponse";

    transferButton.textContent = "⇄";


    transferButton.addEventListener(
        "click",
        () => {

            const answerInputElement =
                answerCell.querySelector(".answer-input");

            if (!answerInputElement) {

                return;

            }

            const questionValue = questionInput.value;

            const answerValue = answerInputElement.value;

            questionInput.value = answerValue;

            answerInputElement.value = questionValue;

        }
    );


    transferCell.appendChild(transferButton);



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


        drawingWrapper = createDrawingAnswer();


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


            transferButton.disabled =
                typeSelect.value === "drawing";

        }
    );


    transferButton.disabled =
        typeSelect.value === "drawing";



    deleteButton.addEventListener(
        "click",
        () => {

            row.remove();


            if (getRows().length === 0) {

                addEmptyMessage();

            }

        }
    );



    row.appendChild(questionCell);

    row.appendChild(transferCell);

    row.appendChild(answerCell);

    row.appendChild(typeCell);

    row.appendChild(deleteCell);


    if (
        addRowControlRow &&
        addRowControlRow.parentNode === cardsTable
    ) {

        cardsTable.insertBefore(row, addRowControlRow);

    } else {

        cardsTable.appendChild(row);

    }


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

    if (
        addRowControlRow &&
        addRowControlRow.parentNode === cardsTable
    ) {

        cardsTable.insertBefore(row, addRowControlRow);

    } else {

        cardsTable.appendChild(row);

    }

}



function getRows() {

    return Array.from(
        cardsTable.querySelectorAll("tr")
    ).filter(
        row =>
            row.id !== "empty-row" &&
            row.id !== "add-row-control"
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


        const typeSelect =
            row.querySelector(
                ".type-select"
            );


        const question =
            questionInput.value.trim();


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


        if (
            cardMode === "drawing" &&
            !drawing
        ) {

            continue;

        }


        newCards.push({

            word: question,

            answer: answer,

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

    cardsTable.appendChild(addRowControlRow);

}



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


addRowControlRow = createAddRowControlRow();

cardsTable.appendChild(addRowControlRow);