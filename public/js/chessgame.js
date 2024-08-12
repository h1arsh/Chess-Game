const socket = io();

const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

const illegal = new Audio('/sounds/illegal.mp3');
const promote = new Audio('/sounds/promote.mp3');
const moveSound_opponent = new Audio('/sounds/move-opponent.mp3');
const castle = new Audio('/sounds/castle.mp3');
const game_start = new Audio('/sounds/game-start.mp3');
const game_end = new Audio('/sounds/game-end.mp3');
const moveSound_self = new Audio('/sounds/move-self.mp3');
const checkSound = new Audio('/sounds/move-check.mp3');
const captureSound = new Audio('/sounds/capture.mp3');

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

let white_time = 600;
let black_time = 600;

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
                const pieceElement = document.createElement("img");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.src = getPieceimage(square);
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

                // Touch events for mobile dragging
                pieceElement.addEventListener("touchstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.preventDefault();
                    }
                });

                pieceElement.addEventListener("touchend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                    e.preventDefault();
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

            // Touch events for mobile dragging
            squareElement.addEventListener("touchmove", (e) => {
                if (draggedPiece) {
                    const touch = e.touches[0];
                    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (targetElement && targetElement.classList.contains("square")) {
                        const targetSource = {
                            row: parseInt(targetElement.dataset.row),
                            col: parseInt(targetElement.dataset.col),
                        };
                        handleMove(sourceSquare, targetSource);
                    }
                }
                e.preventDefault();
            });
            
            boardElement.appendChild(squareElement);
        });
    });   

    const whiteTimerElement = document.getElementById("white-timer");
    const blackTimerElement = document.getElementById("black-timer");

    if(playerRole === 'b')
    {
        boardElement.classList.add("flipped");
        whiteTimerElement.style.top = '-80px';
        whiteTimerElement.style.bottom = 'auto';
        blackTimerElement.style.bottom = '-80px';
        blackTimerElement.style.top = 'auto';
    }
    else
    {
        boardElement.classList.remove("flipped");
        whiteTimerElement.style.bottom = '-80px';
        whiteTimerElement.style.top = 'auto';
        blackTimerElement.style.top = '-80px';
        blackTimerElement.style.bottom = 'auto';
    }
};

const handleMove = (source,target) => {
    
    const move = {
        from : `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to : `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion : null,
    };

    // Check if the move is legal before proceeding with pawn promotion or any other actions
    const legalMove = chess.move(move);

    if (legalMove) {
        // If the move is legal, check for pawn promotion
        if (legalMove.piece === 'p' && (move.to[1] === '1' || move.to[1] === '8')) {
            // Undo the move to allow for proper promotion handling
            chess.undo();
            showPromotionUI(move, (promotion) => {
                move.promotion = promotion;
                promote.play(); // Play promotion sound
                chess.move(move); // Reapply the move with promotion
                socket.emit("move", move);
                renderBoard();
            });
        } else {
            // If the move doesn't involve promotion, finalize the move
            finalizeMove(legalMove);
        }
    } else {
        illegal.play();
    }
};

const finalizeMove = (move) => {
    // Determine which sound to play based on the move type
    if (move.flags.includes('c')) {
        captureSound.play();
    } else if (move.flags.includes('k') || move.flags.includes('q')) {
        castle.play();
    } else {
        moveSound_self.play();
    }

    // Check if the move results in a check
    if (chess.in_check()) {
        checkSound.play();
    }

    socket.emit("move", move);
    renderBoard();
};

// Pawn promotion Logic

const showPromotionUI = (move, callback) => {
    promotionUI = document.createElement("div");
    promotionUI.classList.add("promotion-container");

    const pieces = ["q", "r", "b", "n"]; // queen, rook, bishop, knight

    pieces.forEach(piece => {
        const button = document.createElement("img");
        button.classList.add("promotion-button");
        button.src = getPieceimage({ type: piece, color: chess.turn() });

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

    promotionUI.style.top = `${targetSquareRect.top + window.scrollY + targetSquareRect.height/2  -70}px`;
    promotionUI.style.left = `${targetSquareRect.left + window.scrollX + targetSquareRect.width/2}px`;

    document.body.appendChild(promotionUI);
};


const getPieceimage = (piece) => {
    const imagePieces = {
        k: "/images/bk.png",
        q: "/images/bq.png",
        r: "/images/br.png",
        b: "/images/bb.png",
        n: "/images/bn.png",
        p: "/images/bp.png",
        K: "/images/wk.png",
        Q: "/images/wq.png",
        R: "/images/wr.png",
        B: "/images/wb.png",
        N: "/images/wn.png",
        P: "/images/wp.png",
    };

    return imagePieces[piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase()] || "";
};

//Store History

let moveCount = 0; // Track the move count to determine which column to place the move

function updateMoveHistory(move) {
    const moveHistoryTextarea = document.getElementById("moveHistoryTextarea");
    
    if (moveCount % 2 === 0) {
        // Create a new line for White's move
        moveHistoryTextarea.value += `${Math.floor(moveCount / 2) + 1}. ${move.san} `;
    } else {
        // Append Black's move to the same line
        moveHistoryTextarea.value += `                    ${move.san}\n`;
    }

    moveHistoryTextarea.scrollTop = moveHistoryTextarea.scrollHeight; // Auto-scroll to the bottom
    moveCount++;
}


// Timer Logic 

const updateTimerUI = () =>{
    const white_timer_element = document.getElementById('white-timer');
    const black_timer_element = document.getElementById('black-timer');

    if (playerRole === 'b') {
        // If the player is black, swap the timer display
        white_timer_element.textContent = formatTime(black_time);
        black_timer_element.textContent = formatTime(white_time);
    } else {
        // Default behavior for white player
        white_timer_element.textContent = formatTime(white_time);
        black_timer_element.textContent = formatTime(black_time);
    }
};

const formatTime = (time) =>{
    const minutes = Math.floor(time/60);
    const seconds = time % 60;
    return `${minutes}:${seconds<10 ? '0' : ''}${seconds}`;
}


socket.on("resetBoard", () => {
    chess.reset();
    renderBoard();
    const moveHistoryTextarea = document.getElementById("moveHistoryTextarea");
    moveHistoryTextarea.value = ""; // Clear the move history
    moveCount = 0;
    white_time = 600;
    black_time = 600;
    updateTimerUI();
});

socket.on("updatetimer",({white_time: newWhiteTime , black_time:newBlackTime}) =>{
    if (playerRole === 'b') {
        // If the player is black, swap the timer values
        white_time = newBlackTime;
        black_time = newWhiteTime;
    } else {
        // Default behavior for white player
        white_time = newWhiteTime;
        black_time = newBlackTime;
    }
    updateTimerUI();
});

socket.on("playerRole", function(role){
    playerRole = role;
    game_start.play(); // Play game start sound when player role is assigned
    renderBoard();
    updateTimerUI();
});

socket.on("spectatorRole" , function()
{
    playerRole = null;
    renderBoard();
    updateTimerUI(); // Ensure spectators see correct timer values
});

socket.on("boardState", function(fen){
    if(fen)
    {
        chess.load(fen);
        renderBoard();
    }
    else 
    {
        console.error("Received undefined FEN string");
    }
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard(); 
    updateMoveHistory(move) // store move history
    moveSound_opponent.play(); // Play move sound for opponent
    if (chess.in_check()) {
        checkSound.play();
    }
});

socket.on("gameover",function(message){
    game_end.play(); // Play game end sound
    alert(message);
    setTimeout(() => {
        window.location.href = "/";
        socket.emit("resetGame");
    }, 5000);
});


renderBoard();