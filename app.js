const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const gameRoutes = require("./gameRoutes");

const app = express();

const server = http.createServer(app);
const io = socket(server);

let games = {};
let gameCounter = 0;
let waitingPlayer = null;

const createNewGame = () => {
    const gameId = `game_${gameCounter++}`;
    games[gameId] = {
        chess: new Chess(),
        players: {},
        currentPlayer: "w",
        white_time: 600,
        black_time: 600,
        intervalID: null
    };
    return gameId;
};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('start_game');
});

app.get("/index", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

app.use("/", gameRoutes);

const start_timer = (gameId) => {
    const game = games[gameId];
    clearInterval(game.intervalID);

    game.intervalID = setInterval(() => {
        if (game.currentPlayer === 'w') {
            game.white_time--;
            io.to(gameId).emit("updatetimer", { white_time: game.white_time, black_time: game.black_time });
        } else if (game.currentPlayer === 'b') {
            game.black_time--;
            io.to(gameId).emit("updatetimer", { white_time: game.white_time, black_time: game.black_time });
        }

        if (game.white_time <= 0) {
            clearInterval(game.intervalID);
            io.to(gameId).emit("gameover", "Time is up! Black Wins by Timeout");
        } else if (game.black_time <= 0) {
            clearInterval(game.intervalID);
            io.to(gameId).emit("gameover", "Time is up! White Wins by Timeout");
        }
    }, 1000);
};

// Clean up inactive games
const cleanUpInactiveGames = () => {
    for (const gameId in games) {
        const game = games[gameId];
        if (!game.players.white && !game.players.black) {
            clearInterval(game.intervalID);
            delete games[gameId];
        }
    }
};

setInterval(cleanUpInactiveGames, 60000); // Clean up every minute

io.on("connection", function (uniquesocket) {
    console.log("connected");

    let assignedGameId = null;

    if (waitingPlayer) {
        assignedGameId = waitingPlayer.gameId;
        games[assignedGameId].players.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b");
        waitingPlayer = null;
    } else {
        assignedGameId = createNewGame();
        games[assignedGameId].players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");
        waitingPlayer = { gameId: assignedGameId, socketId: uniquesocket.id };
    }

    uniquesocket.join(assignedGameId);
    uniquesocket.gameId = assignedGameId;

    uniquesocket.on("disconnect", function () {
        const game = games[uniquesocket.gameId];
        if (uniquesocket.id === game.players.white) {
            delete game.players.white;
        } else if (uniquesocket.id === game.players.black) {
            delete game.players.black;
        }
        if (waitingPlayer && waitingPlayer.socketId === uniquesocket.id) {
            waitingPlayer = null;
        }
    });

    uniquesocket.on("move", (move) => {
        const game = games[uniquesocket.gameId];
        try {
            if (game.chess.turn() === 'w' && uniquesocket.id !== game.players.white) {
                console.log("No, it's White's turn");
                return;
            }
            if (game.chess.turn() === 'b' && uniquesocket.id !== game.players.black) {
                console.log("No, it's Black's turn");
                return;
            }

            const result = game.chess.move(move);

            if (result) {
                game.currentPlayer = game.chess.turn();
                start_timer(uniquesocket.gameId);
                io.to(uniquesocket.gameId).emit("move", result);
                io.to(uniquesocket.gameId).emit("boardState", game.chess.fen());

                if (game.chess.isCheckmate()) {
                    const winner = game.chess.turn() === 'w' ? 'Black' : 'White';
                    io.to(uniquesocket.gameId).emit("gameover", `Checkmate! ${winner} wins the game`);
                } else if (game.chess.isDraw()) {
                    io.to(uniquesocket.gameId).emit("gameover", "Draw! the game is a draw");
                } else if (game.chess.isInsufficientMaterial()) {
                    io.to(uniquesocket.gameId).emit("gameover", "Draw! The game is a draw due to insufficient material.");
                } else if (game.chess.isStalemate()) {
                    io.to(uniquesocket.gameId).emit("gameover", "Stalemate! The game is a draw.");
                } else if (game.chess.isThreefoldRepetition()) {
                    io.to(uniquesocket.gameId).emit("gameover", "Draw! The game is a draw by threefold repetition.");
                }
            } else {
                console.log("Invalid move : ", move);
                uniquesocket.emit("invalidMove", move);
            }

        } catch (err) {
            console.log(err);
            uniquesocket.emit("Invalid Move : ", move);
        }
    });

    uniquesocket.on("resetGame", () => {
        const game = games[uniquesocket.gameId];
        game.chess.reset();
        game.white_time = 600;
        game.black_time = 600;
        io.to(uniquesocket.gameId).emit("resetBoard");
        io.to(uniquesocket.gameId).emit("boardState", game.chess.fen());
        io.to(uniquesocket.gameId).emit("updatetimer", { white_time: game.white_time, black_time: game.black_time });
    });

});

server.listen(3000, function () {
    console.log("Server is Listening on port no 3000");
});
