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
let draggedSourceSquare = null; // To keep track of the source square during drag

document.addEventListener('DOMContentLoaded', () => {

    const themeSelect = document.getElementById('theme');
    
    const savedTheme = localStorage.getItem('theme') || 'default';
    setTheme(savedTheme);
    themeSelect.value = savedTheme;

    themeSelect.addEventListener('change', (event) => {
        const selectedTheme = event.target.value;
        setTheme(selectedTheme);
    });
    
    document.getElementById('resignButton').addEventListener('click', resignGame);


    game_start.play();
    renderBoard();
    updateTimerUI();
});

function resignGame() {
    if (confirm("Are you sure you want to resign?")) {
        socket.emit("resignGame");
    }
}

function setTheme(theme) {
    document.body.classList.remove('default-theme', 'dark-theme', 'light-theme', 'classic-theme', 'wooden-theme', 'futuristic-theme');
    if (theme !== 'default') {
        document.body.classList.add(`${theme}-theme`);
    }
    localStorage.setItem('theme', theme);
}

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
                    draggedSourceSquare = `${String.fromCharCode(97 + squareindex)}${8 - rowindex}`;
                    e.dataTransfer.setData("text/plain", draggedSourceSquare);

                    // Highlight possible moves for the dragged piece
                    highlightPossibleMoves(draggedSourceSquare);
                });

                pieceElement.addEventListener("dragend", (e) => {
                    removeHighlightFromAllSquares(); // Clear any highlights when dragging ends
                    draggedSourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            // Event listeners for drag and drop
            squareElement.addEventListener("dragover", handleDragOver);
            squareElement.addEventListener("drop", (e) => handleDrop(e, rowindex, squareindex));

            // Ensure correct piece drag-drop handling based on role
            squareElement.addEventListener("click", () => {
                if (playerRole) {
                    handleSquareClick(rowindex, squareindex);
                }
            });
            squareElement.addEventListener("touchend", () => {
                if (playerRole) {
                    handleSquareClick(rowindex, squareindex);
                }
            });
            
            boardElement.appendChild(squareElement);
        });

    });   

    const whiteTimerElement = document.getElementById("white-timer");
    const blackTimerElement = document.getElementById("black-timer");

    if(playerRole === 'b')
    {
        boardElement.classList.add("flipped");
        whiteTimerElement.style.top = '-100px';
        whiteTimerElement.style.bottom = 'auto';
        blackTimerElement.style.bottom = '-100px';
        blackTimerElement.style.top = 'auto';
    }
    else
    {
        boardElement.classList.remove("flipped");
        whiteTimerElement.style.bottom = '-100px';
        whiteTimerElement.style.top = 'auto';
        blackTimerElement.style.top = '-100px';
        blackTimerElement.style.bottom = 'auto';
    }

    function handleSquareClick(row, col) {
        const squareId = `${String.fromCharCode(97 + col)}${8 - row}`;
        const selectedPiece = chess.get(squareId);
    
        // Check if the player is allowed to select the piece
        if (selectedPiece && selectedPiece.color === playerRole) {
            // If a piece is selected, highlight possible moves
            selectedPieceSquare = squareId;
            highlightPossibleMoves(selectedPieceSquare);
        } else if (selectedPieceSquare) {
            // If a piece was previously selected, try to move to the clicked square
            const move = {
                from: selectedPieceSquare,
                to: squareId,
                promotion: null
            };
            handlePromotionAndMove(move);
            selectedPieceSquare = null; // Deselect piece after move
            removeHighlightFromAllSquares(); // Remove highlights after move
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
    }
    
    function handleDrop(e, rowIndex, colIndex) {
        e.preventDefault();
    
        const targetSquare = `${String.fromCharCode(97 + colIndex)}${8 - rowIndex}`;
        const move = {
            from: draggedSourceSquare,
            to: targetSquare,
            promotion: null
        };
        handlePromotionAndMove(move);
        
        removeHighlightFromAllSquares(); // Remove highlights after move
        draggedSourceSquare = null; // Reset source square
    }
    
    function handleDragEnd() {
        removeHighlightFromAllSquares(); // Clear any highlights when dragging ends
        draggedSourceSquare = null;
    }
    
};

function highlightPossibleMoves(squareId) {
    removeHighlightFromAllSquares(); // Clear previous highlights
    const moves = chess.moves({ square: squareId, verbose: true });

    moves.forEach((move) => {
        const targetSquare = document.querySelector(`.square[data-row="${8 - parseInt(move.to[1], 10)}"][data-col="${move.to.charCodeAt(0) - 97}"]`);
        if (targetSquare) {
            targetSquare.classList.add("highlight");
        }
    });
}

function removeHighlightFromAllSquares() {
    document.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));
}

function makeMove(move) {
    socket.emit('move', move,);
    updateMoveHistory(move);    
}

function handlePromotionAndMove(move)
{
    // Check if the move is legal first
    const isLegal = chess.move({ from: move.from, to: move.to, promotion: 'q' }, { sloppy: true });

    if (!isLegal) {
        // Play illegal move sound and return if the move is not legal
        illegal.play();
        return;
    }

    // Revert the move to handle promotion properly
    chess.undo();

    // Check for pawn promotion
    if (chess.get(move.from).type === 'p' && ((chess.turn() === 'b' && move.to[1] === '1') || (chess.turn() === 'w' && move.to[1] === '8'))) {
        showPromotionUI(move, (promotion) => {
            move.promotion = promotion;
            chess.move(move); // Make the promotion move on the board
            promote.play(); // Play promotion sound
            socket.emit("move", move);
        });
    } else {
        const legalMove = chess.move(move);
        if (legalMove) {
            if (legalMove.flags.includes('c')) {
                captureSound.play();
            } else if (legalMove.flags.includes('k') || legalMove.flags.includes('q')) {
                castle.play();
            } else {
                moveSound_self.play();
            }

            if (chess.in_check()) {
                checkSound.play();
            }

            socket.emit("move", move);
        } else {
            illegal.play();
        }
    }
}

const handleMove = (source,target) => {
    
    const move = {
        from : `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to : `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion : null,
    };

    handlePromotionAndMove(move);
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
    }, 7000);
});


renderBoard();