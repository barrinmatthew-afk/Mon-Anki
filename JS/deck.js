function loadDecks() {

    const saved = localStorage.getItem("decks");

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

}



const decks = loadDecks();


const deckName =
    localStorage.getItem("manageDeckName");


const deck =
    decks.find(
        currentDeck => currentDeck.name === deckName
    );


const titleElement =
    document.getElementById("deck-title");

const subtitleElement =
    document.getElementById("deck-subtitle");

const cardsTable =
    document.getElementById("cards-table");


if (!deck) {

    alert("Deck introuvable.");

    window.location.href = "index.html";

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

            context.fillStyle = "white";

            context.fillRect(0, 0, width, height);

            context.drawImage(image, 0, 0, width, height);


            callback(
                canvas.toDataURL("image/jpeg", 0.85)
            );

        };


        image.src = reader.result;

    };


    reader.readAsDataURL(file);

}



function renderEmptyMessage() {

    cardsTable.innerHTML = `

        <tr id="empty-row">

            <td colspan="4" class="empty-message">
                Ce deck ne contient aucune carte.
            </td>

        </tr>

    `;

}



function renderCards() {

    cardsTable.innerHTML = "";


    if (deck.cards.length === 0) {

        renderEmptyMessage();

        return;

    }


    deck.cards.forEach(card => {

        const row = document.createElement("tr");


        /* --- Question --- */

        const questionCell = document.createElement("td");

        const questionInput = document.createElement("input");

        questionInput.type = "text";

        questionInput.value = card.word || "";

        questionCell.appendChild(questionInput);


        /* --- Réponse --- */

        const answerCell = document.createElement("td");


        let answerInput = null;

        let pendingDrawing = card.drawing || "";


        if (card.mode === "drawing") {

            const wrapper = document.createElement("div");

            wrapper.className = "drawing-cell";


            const preview = document.createElement("img");

            preview.src = card.drawing || "";

            wrapper.appendChild(preview);


            const replaceButton = document.createElement("button");

            replaceButton.type = "button";

            replaceButton.textContent = "📁 Remplacer l'image";

            wrapper.appendChild(replaceButton);


            const fileInput = document.createElement("input");

            fileInput.type = "file";

            fileInput.accept = "image/*";

            fileInput.style.display = "none";

            wrapper.appendChild(fileInput);


            replaceButton.addEventListener(
                "click",
                () => fileInput.click()
            );


            fileInput.addEventListener(
                "change",
                () => {

                    const file = fileInput.files[0];

                    if (!file) {

                        return;

                    }


                    resizeImageToDataURL(
                        file,
                        1000,
                        dataURL => {

                            pendingDrawing = dataURL;

                            preview.src = dataURL;

                        }
                    );

                }
            );


            answerCell.appendChild(wrapper);

        } else {

            answerInput = document.createElement("input");

            answerInput.type = "text";

            answerInput.value = card.answer || "";

            answerCell.appendChild(answerInput);

        }


        /* --- Type --- */

        const typeCell = document.createElement("td");

        typeCell.className = "type-cell";

        typeCell.textContent =
            card.mode === "drawing" ? "✏️ Dessin" : "Texte";


        /* --- Actions --- */

        const actionsCell = document.createElement("td");

        actionsCell.className = "actions-cell";


        const saveButton = document.createElement("button");

        saveButton.type = "button";

        saveButton.className = "save-button";

        saveButton.textContent = "Enregistrer";


        const statusSpan = document.createElement("span");

        statusSpan.className = "row-status";


        const deleteButton = document.createElement("button");

        deleteButton.type = "button";

        deleteButton.className = "delete-button";

        deleteButton.textContent = "Supprimer";


        saveButton.addEventListener(
            "click",
            () => {

                card.word = questionInput.value.trim();


                if (card.mode === "drawing") {

                    card.drawing = pendingDrawing;

                } else {

                    card.answer = answerInput.value.trim();

                }


                saveDecks(decks);


                statusSpan.textContent = "✓ Enregistré";


                setTimeout(
                    () => {

                        statusSpan.textContent = "";

                    },
                    1500
                );

            }
        );


        deleteButton.addEventListener(
            "click",
            () => {

                const confirmation = confirm(
                    "Supprimer cette carte ?"
                );

                if (!confirmation) {

                    return;

                }


                const index =
                    deck.cards.indexOf(card);

                if (index !== -1) {

                    deck.cards.splice(index, 1);

                }


                saveDecks(decks);

                renderCards();

                updateSubtitle();

            }
        );


        actionsCell.appendChild(saveButton);

        actionsCell.appendChild(statusSpan);

        actionsCell.appendChild(deleteButton);


        row.appendChild(questionCell);

        row.appendChild(answerCell);

        row.appendChild(typeCell);

        row.appendChild(actionsCell);


        cardsTable.appendChild(row);

    });

}



function updateSubtitle() {

    subtitleElement.textContent =
        `${deck.cards.length} carte(s)`;

}



titleElement.textContent =
    deck.name;


updateSubtitle();

renderCards();