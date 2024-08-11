const express = require("express");
const router = express.Router();
let games = {};

router.get("/create_or_join", (req, res) => {
    res.render("create_or_join", { title: "Create or Join Game" });
});

router.get("/create_game", async (req, res) => {
    const { nanoid } = await import('nanoid');
    const gameKey = nanoid(8);
    games[gameKey] = { players: {} };
    res.render("create_game", { title: "Game Created", gameKey: gameKey });
});

router.get("/join_game", (req, res) => {
    res.render("join_game", { title: "Join Game", error: null });
});

router.post("/join_game", (req, res) => {
    console.log(req.body); // Check what is in req.body
    const gameKey = req.body.key;
    if (games[gameKey]) {
        res.redirect(`/index?key=${gameKey}`);
    } else {
        res.render("join_game", { title: "Join Game", error: "Invalid game key. Please try again." });
    }
});


module.exports = router;
