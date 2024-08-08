const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();

let players = {};
let currentPlayer = "w";

app.set("view engine","ejs");
app.use(express.static(path.join(__dirname,"public")));

app.get("/", (req,res) => {
    res.render("index" , {title : "Chess Game"});
});

io.on("connection" , function(uniquesocket){
    console.log("connected");

    // uniquesocket.on("disconnect", function(){
    //     console.log("disconnected");
    // });

    if(!players.white)
    {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");
    }
    else if(!players.black)
    {
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole","b");
    }
    else
    {
        uniquesocket.emit("spectator");
    }

    uniquesocket.on("disconnect", function(){
        if(uniquesocket.id === players.white)
        {
            delete players.white;
        }
        else if(uniquesocket.id === players.black)
        {
            delete players.black;
        }
    });

    uniquesocket.on("move", (move) => {
        try
        {
            if(chess.turn() === 'w' && uniquesocket.id !== players.white)
            {
                console.log("No, it's White's turn");
                return ;
            }
            if(chess.turn() === 'b' && uniquesocket.id !== players.black)
            {
                console.log("No, it's Black's turn");
                return ;
            }

            const result = chess.move(move);

            if(result)
            {
                currentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardState" , chess.fen());

                if(chess.isCheckmate())
                {
                    const winner = chess.turn() === 'w' ? 'Black' : 'White';
                    io.emit("gameover",`Checkmate! ${winner} wins the game`);
                }
                else if(chess.isDraw())
                {
                    io.emit("gameover" , "Draw! the game is a draw");
                }
                else if(chess.isInsufficientMaterial())
                {
                    io.emit("gameover" , "Draw! The game is a draw due to insufficient material.");
                }
                else if(chess.isStalemate())
                {
                    io.emit("gameover", "Stalemate! The game is a draw.");
                }
                else if(chess.isThreefoldRepetition())
                {
                    io.emit("gameover","Draw! The game is a draw by threefold repetition.");
                }
            }
            else
            {
                console.log("Invalid move : ",move);
                uniquesocket.emit("invalidMove",move);
            }

        }
        catch(err)
        {
            console.log(err);
            uniquesocket.emit("Inavlid Move : ", move);
        }
    });

});

server.listen(3000, function(){
    console.log("Server is Listening on port no 3000");
});
