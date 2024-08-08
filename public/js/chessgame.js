const socket = io();

const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

const moveSound = new Audio('/sounds/move-self.mp3');
const checkSound = new Audio('/sounds/move-check.mp3');
const captureSound = new Audio('/sounds/capture.mp3');

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

// Elements for promotion UI
let promotionUI = null;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    // console.log(board);
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square",
                (rowindex + squareindex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;

            if(square)
            {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) =>{
                    if(pieceElement.draggable)
                    {
                        draggedPiece = pieceElement;
                        sourceSquare = { row : rowindex , col : squareindex};
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if(draggedPiece)
                {
                    const targetSource = {
                        row : parseInt(squareElement.dataset.row),
                        col : parseInt(squareElement.dataset.col),

                    };

                    handleMove(sourceSquare,targetSource);
                }
            });
            boardElement.appendChild(squareElement);
        });
    });   

    if(playerRole === 'b')
    {
        boardElement.classList.add("flipped");
    }
    else
    {
        boardElement.classList.remove("flipped");
    }
};

const handleMove = (source,target) => {
    
    const move = {
        from : `${String.fromCharCode(97+source.col)}${8-source.row}`,
        to : `${String.fromCharCode(97+target.col)}${8-target.row}`,
        promotion : "q",
    };
    // Check for pawn promotion
    if (chess.get(move.from).type === 'p' && (move.to[1] === '1' || move.to[1] === '8')) {
        showPromotionUI(move, (promotion) => {
            move.promotion = promotion;
            socket.emit("move", move);
        });
    } else {
        socket.emit("move", move);
    }
};

// Pawn promotion Logic

const showPromotionUI = (move, callback) => {
    promotionUI = document.createElement("div");
    promotionUI.classList.add("promotion-container");

    const pieces = ["q", "r", "b", "n"]; // queen, rook, bishop, knight

    pieces.forEach(piece => {
        const button = document.createElement("button");
        button.classList.add("promotion-button");
        button.innerText = getPieceUnicode({ type: piece, color: chess.turn() });

        button.addEventListener("click", () => {
            promotionUI.remove();
            callback(piece);
        });

        promotionUI.appendChild(button);
    });

    // Calculate the position of the promotion UI
    const targetSquare = document.querySelector(
        `.square[data-row="${8 - parseInt(move.to[1], 10)}"][data-col="${move.to.charCodeAt(0) - 97}"]`
    );
    const targetSquareRect = targetSquare.getBoundingClientRect();

    // Add offset to position the promotion box above the pawn
    const offset = -50; // Adjust this value as needed

    promotionUI.style.top = `${targetSquareRect.top + window.scrollY + offset}px`;
    promotionUI.style.left = `${targetSquareRect.left + window.scrollX}px`;

    document.body.appendChild(promotionUI);
};


const getPieceUnicode = (piece) => {
    const unicodePieces = {
        k: "♔",
        q: "♕",
        r: "♖",
        b: "♗",
        n: "♘",
        p: "♙",
        K: "♚",
        Q: "♛",
        R: "♜",
        B: "♝",
        N: "♞",
        P: "♟︎",
    };

    return unicodePieces[piece.type] || "";
};


socket.on("playerRole", function(role){
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole" , function()
{
    playerRole = null;
    renderBoard();
});

socket.on("boardState", function(){
    chess.load(fen);
    renderBoard();
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
    moveSound.play();
    if (chess.in_check()) {
        checkSound.play();
    }
});

socket.on("gameover",function(message){
    alert(message);
});


renderBoard();