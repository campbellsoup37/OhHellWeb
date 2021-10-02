var debug = false;

var express = require("express");
var socket = require("socket.io");
var fs = require('fs');
var ai = require('./ai');
var ml = require('./ml');

// App setup
var app = express();
var port = 6066;
var server = app.listen(port, function () {
    console.log("listening to requests on port " + port);
});

// Static files
app.use(express.static("public"));

// Socket setup
var io = socket(server);
var userDict = {};
var gameDict = {};

// constants
var gameExpirationTime = 1000 * 10;
var robotNames = fs.readFileSync('./misc/firstnames.txt', 'utf8').split('\r\n');

function addUser(user, confirm) {
    userDict[user.socket.id] = user;
    if (confirm) {
        user.confirmLogin();
    }
}

function removeUser(user) {
    delete userDict[user.socket.id];
    user.confirmLogout();
}

function log(str) {
    console.log(`${new Date().toLocaleString()}:\t${str}`)
}

io.on("connection", function (socket) {
    log(`socket ${socket.id} connected at address ${socket.handshake.address}.`);

    socket.on("login", function (data) {
        let user = new User(socket, data.id);
        addUser(user, true);
        log(`user ${user.id} at socket ${socket.id}.`);
    });
    socket.on("logout", function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to logout, but they are not in the user dict.`);
            return;
        }

        log("logout", user.id);
        removeUser(user);
    });
    socket.on("disconnect", function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`socket ${socket.id} disconnected.`);
            return;
        }

        log(`user ${user.id} disconnected.`);

        if (user.player) {
            user.game.disconnectPlayer(user, false);
        }
        removeUser(user);
    });

    socket.on('gamelist', () => {
        let user = userDict[socket.id];

        if (user === undefined) {
            //log(`ERROR: socket ${socket.id} requested the game list, but they are not in the user dict.`);
            return;
        }

        user.sendGameList();
    });

    socket.on('creategame', data => {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to create a game, but they are not in the user dict.`);
            return;
        }

        let game = new Game(data.mode, data.multiplayer, data.multiplayer);
        if (data !== undefined && data.options !== undefined) {
            game.core.updateOptions(data.options);
        }

        gameDict[game.id] = game;
        user.advertise(game);

        log(`new ${data.multiplayer ? 'multiplayer' : 'single player'} game: ${game.id}, hosted by ${user.id}.`);
    });
    socket.on('joingame', id => {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to join game ${id}, but they are not in the user dict.`);
            return;
        }

        let game = gameDict[id];

        if (game === undefined) {
            user.gameJoinError();
            return;
        }

        game.joinPlayer(user);

        log(`${user.id} joined game ${game.id}.`);
    });
    socket.on('leavegame', () => {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to leave game, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (game === undefined) {
            log(`ERROR: user ${user.id} tried to join game, but they are not in a game.`);
            return;
        }

        user.game.disconnectPlayer(user);

        log(`${user.id} left game ${game.id}.`);
    });

    socket.on('autojoin', data => {
        let user = new User(socket, data.userId);
        addUser(user, false);

        let game = gameDict[data.gameId];

        if (game === undefined) {
            user.gameJoinError();
            return;
        }

        game.joinPlayer(user);

        log(`${user.id} joined game ${game.id}.`);
    });

    socket.on('player', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to update player, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to update player, but they are not in a game.`);
            return;
        }

        game.players.updatePlayer(data);
    });
    socket.on('options', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to update options, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to update options, but they are not in a game.`);
            return;
        }

        game.core.updateOptions(data);
    });
    socket.on('start', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to start a game, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to start a game, but they are not in a game.`);
            return;
        }

        game.core.startGame();
    });
    socket.on('end', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to end a game, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to end a game, but they are not in a game.`);
            return;
        }

        game.core.endGame(user.player.index);
    });
    socket.on('bid', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to bid, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to bid, but they are not in a game.`);
            return;
        }

        game.core.incomingBid(user.player.index, data.bid);
        user.player.readiedBid = undefined;
    });
    socket.on('play', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to play, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to play, but they are not in a game.`);
            return;
        }

        game.core.incomingPlay(user.player.index, new Card(data.card.num, data.card.suit));
        user.player.readiedPlay = undefined;
    });
    socket.on('pass', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to pass, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to pass, but they are not in a game.`);
            return;
        }

        game.core.incomingPass(user.player.index, data.cards.map(c => new Card(c.num, c.suit)));
        user.player.readiedPass = undefined;
    });
    socket.on('chat', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to chat, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to chat, but they are not in a game.`);
            return;
        }

        game.core.incomingChat(user.player.index, data);
    });
    socket.on('replacewithrobot', function (index) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to replace with robot, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to replace with robot, but they are not in a game.`);
            return;
        }

        game.core.replaceWithRobot(user.player.index, index);
    });
    socket.on('poke', function (index) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to poke someone, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to poke someone, but they are not in a game.`);
            return;
        }

        game.core.poke(index);
    });
    socket.on('claim', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to claim, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to claim, but they are not in a game.`);
            return;
        }

        game.core.incomingClaim(user.player.index);
    });
    socket.on('claimresponse', function (accept) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to respond to a claim, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to respond to a claim, but they are not in a game.`);
            return;
        }

        game.core.respondToClaim(user.player.index, accept);
    });

    socket.on('reteam', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to reteam, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to reteam, but they are not in a game.`);
            return;
        }

        game.core.reteam(user.player.index, data.index, data.team);
    });
    socket.on('scrambleteams', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            log(`ERROR: socket ${socket.id} tried to scramble teams, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            log(`ERROR: user ${user.id} tried to scramble teams, but they are not in a game.`);
            return;
        }

        game.core.scrambleTeams(user.player.index);
    });
});

// User
class User {
    constructor(socket, id) {
        this.socket = socket;
        this.id = id;
        this.player = undefined;
        this.game = undefined;
    }

    confirmLogin() {
        this.socket.emit('loginconfirmed');
    }

    confirmLogout() {
        this.socket.emit('logoutconfirmed');
    }

    gameJoinError() {
        this.socket.emit('gamejoinerror');
    }

    advertise(game) {
        this.socket.emit('gamecreated', game.toDict());
    }

    kick() {
        this.player = undefined;
        this.game = undefined;

        if (this.socket.connected) {
            this.socket.emit('kick');
        }
    }

    sendGameList() {
        let time = new Date().getTime();
        let expires = Object.values(gameDict).filter(g => g.shouldExpire(time));
        expires.forEach(g => g.dispose());

        let games = Object.values(gameDict).filter(g => g.public && g.listed);
        this.socket.emit('gamelist', {
            games: games.map(g => g.toDict())
        });
    }
}

// Game
class Game {
    constructor(mode, mp, pub) {
        this.id = new Date().getTime();
        this.mode = mode;
        this.mp = mp;
        this.public = pub;
        this.listed = false;
        this.players = new PlayersList(this);
        this.host = undefined;

        switch (mode) {
            case 'Oh Hell':
                this.core = new OhHellCore(this.players, this);
                break;
            case 'Oregon Hearts':
                this.core = new OregonHeartsCore(this.players, this);
                break;
        }
    }

    toDict() {
        let inGame = this.core.state == CoreState.BIDDING || this.core.state == CoreState.PLAYING;
        return {
            id: this.id,
            mp: this.mp,
            public: this.public,
            listed: this.listed,
            mode: this.mode,
            host: this.host ? this.host.id : '',
            players: this.players.players.filter(p => p.human).length,
            state: inGame ? 'In game' : 'In lobby'
        };
    }

    joinPlayer(user) {
        let player = new HumanPlayer(user, this.core);
        player.name = user.id;

        if (this.host === undefined) {
            this.host = player;
        }
        player.host = this.host === player;

        user.player = player;
        user.game = this;

        player.commandJoin({mp: this.mp, id: this.id, mode: this.mode});
        this.players.addPlayer(player);

        this.players.updateOptions(this.core.options);

        this.listed = true;
    }

    disconnectPlayer(user, kick) {
        this.players.disconnectPlayer(user.player, kick);
        user.kick();
    }

    startExpirationTimer() {
        this.expiration = new Date().getTime() + gameExpirationTime;
    }

    stopExpirationTimer() {
        this.expiration = undefined;
    }

    shouldExpire(time) {
        return this.expiration && time >= this.expiration;
    }

    jsonFilePath() {
        return `./public/cached_games/${this.id}.ohw`;
    }

    dispose() {
        fs.unlink(this.jsonFilePath(), err => {
            if (err) {
                log(`ERROR: unable to remove ${this.jsonFilePath()}.`);
            }
        });
        delete gameDict[this.id];
    }

    publishJson(json) {
        fs.writeFileSync(this.jsonFilePath(), JSON.stringify(json));
    }
}

// Card and Deck
class Card {
    constructor(num, suit) {
        if (!arguments.length) {
            this.num = 0;
            this.suit = 0;
        } else {
            this.num = num;
            this.suit = suit;
        }
    }

    toDict() {
        return {num: this.num, suit: this.suit};
    }

    isEmpty() {
        return this.num == 0;
    }

    toString() {
        if (this.isEmpty()) {
            return '0';
        }

        let ans = '';
        if (this.num < 10) {
            ans += this.num;
        } else if (this.num == 10) {
            ans += 'T';
        } else if (this.num == 11) {
            ans += 'J';
        } else if (this.num == 12) {
            ans += 'Q';
        } else if (this.num == 13) {
            ans += 'K';
        } else if (this.num == 14) {
            ans += 'A';
        }
        if (this.suit == 0) {
            ans += 'C';
        } else if (this.suit == 1) {
            ans += 'D';
        } else if (this.suit == 2) {
            ans += 'S';
        } else if (this.suit == 3) {
            ans += 'H';
        }

        return ans;
    }

    fromString(str) {
        if (str[0] == 'T') {
            this.num = 10;
        } else if (str[0] == 'J') {
            this.num = 11;
        } else if (str[0] == 'Q') {
            this.num = 12;
        } else if (str[0] == 'K') {
            this.num = 13;
        } else if (str[0] == 'A') {
            this.num = 14;
        } else {
            this.num = parseInt(str[0]);
        }

        if (str[1] == 'C') {
            this.suit = 0;
        } else if (str[1] == 'D') {
            this.suit = 1;
        } else if (str[1] == 'S') {
            this.suit = 2;
        } else if (str[1] == 'H') {
            this.suit = 3;
        }

        return this;
    }

    toNumber() {
        return this.num - 2 + 13 * this.suit;
    }

    compSort(card) {
        if (this.suit == card.suit && this.num == card.num) {
            return 0;
        } else if (this.suit > card.suit || (this.suit == card.suit && this.num > card.num)) {
            return 1;
        } else {
            return -1;
        }
    }

    comp(card, trump, led) {
        let thisVal = this.compHelperVal(trump, led);
        let cardVal = card.compHelperVal(trump, led);
        if (thisVal > cardVal) {
            return 1;
        } else if (thisVal == cardVal) {
            return 0;
        } else {
            return -1;
        }
    }

    compHelperVal(trump, led) {
        let ans = this.num;
        if (this.suit == trump) {
            ans += 2000;
        } else if (this.suit == led) {
            ans += 1000;
        } else {
            return 0;
        }
        return ans;
    }

    matches(card) {
        return this.num == card.num && this.suit == card.suit;
    }
}

class Deck {
    constructor(D) {
        this.D = D;
    }

    initialize() {
        this.deck = []
        for (let d = 1; d <= this.D; d++) {
            for (let suit = 0; suit < 4; suit++) {
                for (let num = 2; num <= 14; num++) {
                    this.deck.push(new Card(num, suit));
                }
            }
        }
    }

    deal(N, h, trump) {
        if (N * h + 1 > 52 * this.D) {
            log('ERROR: tried to deal ' + h + ' cards to ' + N + ' players.');
        }

        let out = [];

        // Shuffle in place
        for (let i = this.deck.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * i);
            let temp = this.deck[i];
            this.deck[i] = this.deck[j];
            this.deck[j] = temp;
        }

        for (let i = 0; i < N; i++) {
            let hand = this.deck.slice(i * h, (i + 1) * h);
            hand.sort((c1, c2) => c1.compSort(c2));
            out.push(hand);
        }

        if (trump) {
            out.push([this.deck[h * N]]);
        }

        return out;
    }
}

// Player
class Player {
    constructor() {
        this.kibitzer = false;
        this.replacedByRobot = false;
        this.team = 0;
    }

    toDict() {
        return {
            name: this.name,
            id: this.id,
            human: this.human,
            host: this.host,
            disconnected: this.disconnected,
            replacedByRobot: this.replacedByRobot,
            kibitzer: this.kibitzer,
            index: this.index,
            team: this.team,
            bid: this.bid,
            bidded: this.bidded,
            taken: this.taken,
            score: this.score,
            trick: this.trick === undefined ? undefined : this.trick.toDict(),
            lastTrick: this.lastTrick === undefined ? undefined : this.lastTrick.toDict()
        };
    }

    toPostGameDict() {
        return {
            id: this.id,
            name: this.name,
            index: this.index,
            team: this.team,
            human: this.human,
            hands: this.hands.map(h => h.map(c => c.toDict())),
            bids: this.bids,
            takens: this.takens,
            scores: this.scores,
            score: this.score,
            plays: this.plays.map(r => r.map(c => c.toDict())),
            wbProbs: this.wbProbs,
            bidQs: this.bidQs,
            makingProbs: this.makingProbs.map(r => r.map(t => t.map(pair => [pair[0].toDict(), pair[1]]))),
            aiBids: this.aiBids,
            diffs: this.diffs,
            lucks: this.lucks,
            hypoPointsLost: this.hypoPointsLost,
            mistakes: this.mistakes
        };
    }

    newGameReset() {
        this.score = 0;
        this.trick = new Card();
        this.lastTrick = new Card();
        this.bids = [];
        this.takens = [];
        this.scores = [];
        this.hands = [];
        this.plays = [];
        this.passes = [];

        this.wbProbs = [];
        this.bidQs = [];
        this.makingProbs = [];
        this.aiBids = [];
        this.diffs = [];
        this.lucks = [];
        this.hypoPointsLost = [];
        this.mistakes = [];
    }

    newRoundReset() {
        this.bid = 0;
        this.taken = 0;
        this.bidded = false;
        this.trick = new Card();
        this.played = false;
        this.lastTrick = new Card();
        this.acceptedClaim = false;
        this.plays.push([]);
        this.pass = [];
        this.passed = false;
        this.cardsTaken = [];
        this.shownOut = [false, false, false, false];
        this.hadSuit = [false, false, false, false];

        this.makingProbs.push([]);
        this.roundMistakes = 0;
    }

    newTrickReset() {
        this.lastTrick = this.trick;
        this.trick = new Card();
        this.played = false;
    }

    addHand(hand) {
        this.hand = hand;
        this.hands.push(hand.map(c => c));
    }

    addBid(bid) {
        this.bid = bid;
        this.bidded = true;
        this.bids.push(bid);

        let qs = this.bidQs[this.bidQs.length - 1];
        let aiBid = this.aiBids[this.aiBids.length - 1];
        this.hypoPointsLost.push(ai.pointsMean(qs, aiBid) - ai.pointsMean(qs, this.bid));
    }

    addPlay(card) {
        this.trick = card;
        this.played = true;
        for (let i = 0; i < this.hand.length; i++) {
            if (this.hand[i].matches(card)) {
                this.hand.splice(i, 1);
            }
        }

        this.plays[this.plays.length - 1].push(card);

        let roundProbs = this.makingProbs[this.makingProbs.length - 1];
        let probs = roundProbs[roundProbs.length - 1];
        let maxProb = Math.max(...probs.map(pair => pair[1]));
        let myProb = probs.filter(pair => pair[0].matches(card))[0][1];
        this.roundMistakes += maxProb < 0.0001 ? 0 : Math.min(maxProb / myProb - 1, 1);
    }

    addPass(cards) {
        this.pass = cards;
        this.passed = true;
        this.passes.push(cards);
    }

    incTaken() {
        this.taken++;
    }

    addTaken() {
        this.takens.push(this.taken);
    }

    addScore(score) {
        this.score += score;
        this.scores.push(this.score);
    }

    voidDealt(suit) {
        return this.shownOut[suit] && !this.hadSuit[suit];
    }

    addWbProb(p) {
        this.wbProbs.push(p);
    }

    startBid(data) {
        if (data.turn == this.index && !this.kibitzer) {
            this.bidAsync();
        }
        this.commandBid(data);
    }

    async bidAsync() {
        let bid = await this.strategyModule.makeBid();
        this.bidReady(bid);
    }

    startPlay(data) {
        if (data.turn == this.index && !this.kibitzer) {
            this.playAsync();
        }
        this.commandPlay(data);
    }

    async playAsync() {
        let card = await this.strategyModule.makePlay();
        this.playReady(card);
    }

    startPass(data) {
        if (!this.kibitzer) {
            this.passAsync();
        }
        this.commandPass(data);
    }

    async passAsync() {
        let cards = await this.strategyModule.makePass();
        this.passReady(cards);
    }

    addQs(qs) {
        this.bidQs.push(qs);
    }

    addAiBid(bid) {
        this.aiBids.push(bid);
    }

    addMakingProbs(probs) {
        this.makingProbs[this.makingProbs.length - 1].push(probs);
    }

    addDiff(diff) {
        this.diffs.push(diff);
    }

    addLuck(luck) {
        this.lucks.push(luck);
    }

    reconnect(player) {}

    poke() {}

    commandGameState(data) {}
    commandAddPlayers(data) {}
    commandRemovePlayers(data) {}
    commandUpdatePlayers(data) {}
    commandUpdateTeams(data) {}
    commandStart() {}
    commandBid(data) {}
    bidReady(bid) {}
    commandPlay(data) {}
    playReady(card) {}
    commandPass(data) {}
    passReady(cards) {}
    commandDeal(data) {}
    updateHands(data) {}
    commandPassReport(data) {}
    commandTrickWinner(data) {}
}

class PlayersList {
    constructor(game) {
        this.game = game;
        this.players = [];
        this.kibitzers = [];
        this.teams = [];
        for (let i = 0; i < 10; i++) {
            this.teams.push(new Team(i, this));
        }
    }

    toDict(index) {
        if (arguments.length == 0) {
            index = -1;
        }
        return {
            info: this.players.map(p => p.toDict()),
            hands: this.players.map(p => p.hand.map(c => (index == -1 || p.index == index ? c : new Card()).toDict())),
            bids: this.players.map(p => p.bids),
            takens: this.players.map(p => p.takens),
            scores: this.players.map(p => p.scores)
        };
    }

    setCore(core) {
        this.core = core;
    }

    size() {
        return this.players.length;
    }

    get(i) {
        return this.players[i];
    }

    emitAll(type, data) {
        for (const list of [this.players, this.kibitzers]) {
            for (const player of list) {
                if (player.human && player.user.socket.connected) {
                    player.user.socket.emit(type, data);
                }
            }
        }
    }

    addPlayer(player) {
        // check if it's a reconnect
        let reconnect = false;
        for (const p of this.players) {
            if (p.id == player.id) {
                p.reconnect(player.user);
                p.setDisconnected(false);
                player = p;

                let playerData = {players: [player.toDict()]};
                for (const list of [this.players, this.kibitzers]) {
                    for (const p1 of list) {
                        if (p1 !== player) {
                            p1.commandUpdatePlayers(playerData);
                        }
                    }
                }

                reconnect = true;
                break;
            }
        }

        if (this.core.state == CoreState.PREGAME || this.core.state == CoreState.POSTGAME) {
            if (!reconnect) {
                player.index = this.players.length;
                this.players.push(player);

                let playerData = {players: [player.toDict()]};
                let allData = {players: this.players.map(p => p.toDict())};
                for (const list of [this.players, this.kibitzers]) {
                    for (const p of list) {
                        if (p !== player) {
                            p.commandAddPlayers(playerData);
                        }
                    }
                }
                player.commandAddPlayers(allData);
                this.updateTeams();
            }
        } else {
            if (!reconnect) {
                this.kibitzers.push(player);
                player.kibitzer = true;
            }
            let allData = {
                players: this.players.map(p => p.toDict())
            };
            player.commandAddPlayers(allData);
            player.commandUpdateTeams({teams: this.teams.map(t => t.toDict())});
            player.commandStart();
            player.commandGameState(this.core.toDict(player.kibitzer ? -1 : player.index));
        }

        this.game.stopExpirationTimer();
    }

    adjustRobotCount(count) {
        let robots = this.getRobots();
        if (robots.length < count) {
            let newRobots = [];
            for (let i = robots.length; i < count; i++) {
                let player = new AiPlayer(i + 1, this.core);
                player.index = this.players.length;
                this.players.push(player);
                newRobots.push(player.toDict());
            }
            this.emitAll('addplayers', {players: newRobots});
            this.updateTeams();
        } else if (robots.length > count) {
            this.removePlayers(robots.slice(count));
        }
    }

    attachStrategyModules(modules) {
        for (let i = 0; i < modules.length; i++) {
            this.players[i].strategyModule = modules[i];
            modules[i].setCoreAndPlayer(this.core, this.players[i]);
        }
    }

    getRobots() {
        return this.players.filter(p => !p.human);
    }

    disconnectPlayer(player, kick) {
        player.setDisconnected(true);

        let prePost = this.core.state == CoreState.PREGAME || this.core.state == CoreState.POSTGAME;

        if (player.kibitzer) {
            this.kibitzers = this.kibitzers.filter(p => p !== player);
        } else if (prePost) {
            this.removePlayers([player]);
        } else {
            this.updatePlayers([player]);
        }

        if (this.players.filter(p => p.human && !p.disconnected).length == 0 && this.kibitzers.length == 0) {
            this.game.startExpirationTimer();

            // we don't want to dispose of the game right away
            if (prePost) {
                this.game.listed = false;
            }
        }

        if (this.game.host === player) {
            this.game.host.host = false;
            this.game.host = undefined;
            for (const p of this.players) {
                if (!p.disconnected && p.human) {
                    this.game.host = p;
                    p.host = true;
                    this.updatePlayers([p]);
                }
            }
        }
    }

    removePlayers(players) {
        this.players = this.players.filter(p => !players.includes(p));
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].index = i;
        }
        let playerData = {indices: players.map(p => p.index)};
        for (const list of [this.players, this.kibitzers]) {
            for (const p of list) {
                p.commandRemovePlayers(playerData);
            }
        }
        this.updateTeams();
    }

    updatePlayers(players) {
        let data = {players: players.map(p => p.toDict())};
        for (const list of [this.players, this.kibitzers]) {
            for (const p of list) {
                p.commandUpdatePlayers(data);
            }
        }
    }

    updatePlayer(data) {
        let player = undefined;
        for (const p of this.players) {
            if (p.id == data.id) {
                player = p;
                break;
            }
        }
        if (!player) {
            for (const p of this.kibitzers) {
                if (p.id == data.id) {
                    player = p;
                    break;
                }
            }
        }

        if (!player.kibitzer && data.kibitzer) {
            this.players = this.players.filter(p => p !== player);
            this.kibitzers.push(player);
            for (let i = player.index; i < this.players.length; i++) {
                this.players[i].index = i;
            }
            let playerData = {indices: [player.index]};
            for (const list of [this.players, this.kibitzers]) {
                for (const p of list) {
                    p.commandRemovePlayers(playerData);
                }
            }
        } else if (player.kibitzer && !data.kibitzer) {
            this.kibitzers = this.kibitzers.filter(p => p !== player);
            this.players.push(player);
            player.index = this.players.length - 1;
            let playerData = {players: [player.toDict()]};
            for (const list of [this.players, this.kibitzers]) {
                for (const p of list) {
                    p.commandAddPlayers(playerData);
                }
            }
        }

        player.name = data.name;
        player.kibitzer = data.kibitzer;
        this.updatePlayers([player]);
    }

    updateOptions(options) {
        this.adjustRobotCount(options.robots);
        this.emitAll('options', options);
    }

    nextUnkicked(i) {
        return (i + 1) % this.size();
    }

    updateRounds(rounds, roundNumber) {
        this.emitAll('updaterounds', {rounds: rounds, roundNumber: roundNumber});
    }

    newGame() {
        for (let i = 0; i < this.size(); i++) {
            let player = this.players[i];
            player.index = i;
            player.newGameReset();
        }
        this.emitAll('start');
    }

    newRound() {
        for (const player of this.players) {
            player.newRoundReset();
        }
    }

    giveHands(hands) {
        for (const player of this.players) {
            player.addHand(hands.hands[player.index]);
            player.commandDeal(hands);
        }
        for (const kibitzer of this.kibitzers) {
            kibitzer.commandDeal(hands);
        }
    }

    sendDealerLeader(dealer, leader) {
        this.emitAll('dealerleader', {dealer: dealer, leader: leader});
    }

    communicateTurn(state, turn, data) {
        if (state == CoreState.BIDDING) {
            for (const player of this.players) {
                player.startBid({turn: turn});
            }
            for (const player of this.kibitzers) {
                player.startBid({turn: turn});
            }
        } else if (state == CoreState.PLAYING) {
            for (const player of this.players) {
                player.startPlay({turn: turn, canPlay: player.index == turn ? data.canPlay.map(c => c.toDict()) : undefined});
            }
            for (const player of this.kibitzers) {
                player.startPlay({turn: turn});
            }
        } else if (state == CoreState.PASSING) {
            for (const player of this.players) {
                player.startPass({turn: turn});
            }
            for (const player of this.kibitzers) {
                player.startPass({turn: turn});
            }
        }
    }

    bidSum() {
        let ans = 0;
        for (const player of this.players) {
            if (player.bidded) {
                ans += player.bid;
            }
        }
        return ans;
    }

    bidReport(index, bid) {
        this.players[index].addBid(bid);
        this.emitAll('bidreport', {index: index, bid: bid, human: this.players[index].human});
    }

    playReport(index, card, isLead, follow) {
        this.players[index].addPlay(card);
        this.players[index].hadSuit[card.suit] = true;
        if (!isLead && card.suit != follow) {
            this.players[index].shownOut[follow] = true;
        }
        this.emitAll('playreport', {index: index, card: {num: card.num, suit: card.suit}, human: this.players[index].human, isLead: isLead});
    }

    passReport(index, cards) {
        this.players[index].addPass(cards);
        for (const player of this.players) {
            player.commandPassReport({index: index, cards: cards});
        }
        for (const kibitzer of this.kibitzers) {
            kibitzer.commandPassReport({index: index, cards: cards});
        }
    }

    allHaveBid() {
        return !this.players.some(p => !p.bidded);
    }

    allHavePassed() {
        return !this.players.some(p => !p.passed);
    }

    allHavePlayed() {
        return !this.players.some(p => p.trick.isEmpty());
    }

    trickWinner(index) {
        this.players[index].incTaken();
        this.players[index].cardsTaken.push(...this.players.map(p => p.trick));

        for (const player of this.players) {
            player.newTrickReset();
        }
        this.emitAll('trickwinner', {index: index});
    }

    hasEmptyHand(index) {
        return this.players[index].hand.length == 0;
    }

    scoreRound() {
        let newScores = [];
        for (const player of this.players) {
            player.addTaken();
            let score = this.core.score(player);
            player.addScore(score);
            newScores.push(player.score);

            player.mistakes.push(player.roundMistakes);

            if (this.game.mode == 'Oregon Hearts') { //TODO
                continue;
            }

            let qs = player.bidQs[player.bidQs.length - 1];
            let mu = ai.pointsMean(qs, player.bid);
            let sig2 = ai.pointsVariance(qs, player.bid);

            let luck = Math.min(5, Math.max(-5,
                (score - mu) / Math.sqrt(sig2)
            ));
            player.addLuck(sig2 == 0 ? 0 : luck);
        }
        this.emitAll('scoresreport', {scores: newScores});
    }

    performPass(offset) {
        let pass = new Array(this.players.length).fill([]);
        let passedTo = new Array(this.players.length).fill(-1);
        for (const player of this.players) {
            if (player.pass.length == 0) {
                continue;
            }
            let i = (player.index + offset + this.players.length) % this.players.length;
            while (i != player.index) {
                if (this.players[i].pass.length > 0) {
                    player.hand = player.hand.filter(c1 => player.pass.filter(c2 => c2.matches(c1)).length == 0);
                    this.players[i].hand.push(...player.pass);
                    this.players[i].hand.sort((c1, c2) => c1.compSort(c2));
                    pass[player.index] = player.pass.map(c => c.toDict());
                    passedTo[player.index] = i;
                    break;
                }
                i = (i + offset + this.players.length) % this.players.length;
            }
        }
        let hands = this.players.map(p => p.hand.map(c => c.toDict()));
        for (const player of this.players) {
            player.updateHands({hands: hands, pass: pass, passedTo: passedTo});
        }
        for (const kibitzer of this.kibitzers) {
            kibitzer.updateHands({hands: hands, pass: pass, passedTo: passedTo});
        }
    }

    addWbProbs(probs) {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].addWbProb(probs[i]);
        }
    }

    postGameData(coreData) {
        return {
            players: this.players.map(p => p.toPostGameDict()),
            teams: this.teams.map(t => t.toDict())
        };
    }

    sendPostGameData(coreData) {
        this.emitAll('postgame', coreData);
    }

    sendChat(index, text) {
        this.emitAll('chat', {sender: this.players[index].name, text: text});
    }

    sendEndGameRequest(index) {
        this.emitAll('end', {index: index});
    }

    replaceWithRobot(index) {
        this.players[index].replaceWithRobot();
        this.updatePlayers([this.players[index]]);
    }

    announceClaim(index) {
        this.emitAll('claim', {index: index, hand: this.players[index].hand.map(c => c.toDict())});
    }

    respondToClaim(index, accept) {
        if (!accept) {
            this.emitAll('claimresult', {accepted: false, claimer: this.core.claimer});
            this.core.claimer = undefined;
        } else {
            this.players[index].acceptedClaim = true;
            if (this.players.filter(p => p.human && !p.replacedByRobot && !p.acceptedClaim).length == 0) {
                let winner = this.players[this.core.claimer];
                let remaining = winner.hand.length;
                if (!winner.trick.isEmpty()) {
                    remaining++;
                }

                winner.taken += remaining;

                this.emitAll('claimresult', {accepted: true, claimer: this.core.claimer, remaining: remaining});
                this.core.acceptClaim();
            } else {
                return;
            }
        }

        for (const player of this.players) {
            player.acceptedClaim = false;
        }
    }

    reteam(index, number) {
        if (number === undefined) {
            for (number = 0; number < 10 && this.teams[number].members.length != 0; number++)
            if (number == 10) {
                return;
            }
        }

        this.players[index].team = number;
        this.updatePlayers([this.players[index]]);
        this.updateTeams();
    }

    scrambleTeams() {
        let properDivisors = [];
        for (let i = 2; i < this.size(); i++) {
            if (this.size() % i == 0) {
                properDivisors.push(i);
            }
        }
        if (properDivisors.length > 0) {
            let numTeams = properDivisors[Math.floor(Math.random() * properDivisors.length)];
            let playersPerTeam = this.size() / numTeams;
            let playersToChoose = this.players.map(p => p);
            for (let i = 0; i < numTeams; i++) {
                for (let j = 0; j < playersPerTeam; j++) {
                    playersToChoose.splice(Math.floor(Math.random() * playersToChoose.length), 1)[0].team = i;
                }
            }

            this.updatePlayers(this.players);
            this.updateTeams();
        }
    }

    updateTeams() {
        for (const team of this.teams) {
            team.buildMembers();
        }
        let data = {teams: this.teams.map(t => t.toDict())};
        for (const list of [this.players, this.kibitzers]) {
            for (const p of list) {
                p.commandUpdateTeams(data);
            }
        }
    }
}

class HumanPlayer extends Player {
    constructor(user, core) {
        super();
        this.user = user;
        this.core = core;
        this.id = user.id;
        this.disconnected = false;
        this.human = true;
    }

    reconnect(user) { // TODO fix this
        if (this.user.socket.connected && this.user.socket !== user.socket) {
            this.user.socket.emit('kick');
        }

        this.user = user;
        user.player = this;
    }

    commandJoin(data) {
        this.user.socket.emit('join', data);
    }

    commandGameState(data) {
        this.user.socket.emit('gamestate', data);
    }

    commandAddPlayers(data) {
        this.user.socket.emit('addplayers', data);
    }

    commandRemovePlayers(data) {
        this.user.socket.emit('removeplayers', data);
    }

    commandUpdatePlayers(data) {
        this.user.socket.emit('updateplayers', data);
    }

    commandUpdateTeams(data) {
        this.user.socket.emit('updateteams', data);
    }

    commandStart() {
        this.user.socket.emit('start');
    }

    commandDeal(data) {
        if (this.kibitzer) {
            this.user.socket.emit('deal', data);
        } else {
            this.user.socket.emit('deal', {
                hands: data.hands.map((h, i) => h.map(c => i == this.index ? c : {num: 0, suit: 0})),
                trump: data.trump
            });
        }
    }

    updateHands(data) {
        if (this.kibitzer) {
            this.user.socket.emit('performpass', data);
        } else {
            this.user.socket.emit('performpass', {
                hands: data.hands.map((h, i) => h.map(c => i == this.index ? c : {num: 0, suit: 0})),
                pass: data.pass.map((h, i) => h.map(c => i == this.index || data.passedTo[i] == this.index ? c : {num: 0, suit: 0})),
                passedTo: data.passedTo
            });
        }
    }

    commandBid(data) {
        this.user.socket.emit('bid', data);
    }

    commandPlay(data) {
        this.user.socket.emit('play', data);
    }

    commandPass(data) {
        this.user.socket.emit('pass', data);
    }

    commandPassReport(data) {
        let copy = data.cards.map(c => data.index == this.index || this.kibitzer ? c : new Card());
        this.user.socket.emit('passreport', {index: data.index, cards: copy});
    }

    commandTrickWinner(data) {
        this.user.socket.emit('trickwinner', data);
    }

    setDisconnected(disc) {
        this.disconnected = disc;
        if (!disc) {
            this.replacedByRobot = false;
        }
    }

    replaceWithRobot() {
        this.replacedByRobot = true;
        if (this.readiedBid !== undefined) {
            this.core.incomingBid(this.index, this.readiedBid);
            this.readiedBid = undefined;
        } else if (this.readiedPlay !== undefined) {
            this.core.incomingPlay(this.index, this.readiedPlay);
            this.readiedPlay = undefined;
        }
    }

    bidReady(bid) {
        if (this.replacedByRobot) {
            this.core.incomingBid(this.index, bid);
            this.readiedBid = undefined;
        } else {
            this.readiedBid = bid;
        }
    }

    playReady(card) {
        if (this.replacedByRobot) {
            this.core.incomingPlay(this.index, card);
            this.readiedPlay = undefined;
        } else {
            this.readiedPlay = card;
        }
    }

    passReady(cards) {
        if (this.replacedByRobot) {
            this.core.incomingPass(this.index, cards);
            this.readiedPass = undefined;
        } else {
            this.readiedPass = cards;
        }
    }

    poke() {
        this.user.socket.emit('poke');
    }
}

class AiPlayer extends Player {
    constructor(i, core) {
        super();
        this.disconnected = false;
        this.human = false;
        this.id = '@robot' + i;
        this.name = robotNames[Math.floor(robotNames.length * Math.random())] + ' bot'
        this.core = core;
    }

    bidReady(bid) {
        this.core.incomingBid(this.index, bid);
    }

    playReady(card) {
        this.core.incomingPlay(this.index, card);
    }

    passReady(cards) {
        this.core.incomingPass(this.index, cards);
    }
}

class Team {
    constructor(number, players) {
        this.number = number;
        this.players = players;
        this.resetName();
    }

    toDict() {
        return {
            number: this.number,
            name: this.name,
            members: this.members.map(p => p.index)
        };
    }

    resetName() {
        this.name = 'Team ' + (this.number + 1);
    }

    buildMembers() {
        this.members = this.players.players.filter(p => p.team == this.number);
    }

    bid() {
        if (this.members.length == 0) {
            return 0;
        } else {
            return this.members.map(p => p.bid).reduce((a, b) => a + b, 0);
        }
    }

    taken() {
        if (this.members.length == 0) {
            return 0;
        } else {
            return this.members.map(p => p.taken).reduce((a, b) => a + b, 0);
        }
    }
}

// Core
var CoreStateEnum = function () {
    this.PREGAME = 0;
    this.BIDDING = 1;
    this.PLAYING = 2;
    this.POSTGAME = 3;
    this.PASSING = 4;
};
var CoreState = new CoreStateEnum();

class Core {
    constructor(players, game) {
        this.state = CoreState.PREGAME;
        this.options = new Options();
        this.players = players;
        this.game = game;
        players.core = this;
    }

    // index = hide all hands except for index
    toDict(index) {
        return {
            options: this.options.toDict(),
            rounds: this.rounds,
            roundNumber: this.roundNumber,
            dealer: this.getDealer(),
            leader: this.leader,
            state: this.state,
            turn: this.turn,
            trump: this.trump.toDict(),
            players: this.players.toDict(index)
        };
    }

    updateOptions(options) {
        this.options.update(options);
        this.players.updateOptions(options);
    }

    startGame() {
        if (!this.verifyGameCanStart()) {
            return;
        }

        this.attachStrategyModules();
        this.randomizePlayerOrder();

        this.buildRounds();
        this.roundNumber = 0;
        this.playNumber = 0;
        this.updateRounds();

        this.players.newGame();

        this.trumps = [];
        this.leaders = [];
        this.winners = [];
        this.claims = [];
        this.deck = new Deck(this.options.D);

        if (debug) {
            var sample = require('./sample');
            this.fullDeals = sample.sample.map(ds => ds.map(h => h.map(c => new Card().fromString(c))));
        }

        this.transitionFromStart();
    }

    endGame(index) {
        if (index != this.game.host.index) {
            log('ERROR: Player "' + this.players.get(index).id + '" tried to end the game, but they are not host.');
            return;
        }

        this.players.sendEndGameRequest(index);
        this.sendPostGame();
    }

    randomizePlayerOrder() {}

    attachStrategyModules() {
        let T = this.players.teams.filter(t => t.members.length > 0).length;
        let modules = ai.buildStrategyModules(
            this.game.mode,
            {
                N: this.players.size(),
                D: this.options.D,
                T: this.options.teams ? T : 0
            }
        );
        this.players.attachStrategyModules(modules);
    }

    updateRounds() {
        let dIndex = this.players.nextUnkicked(-1);
        for (const round of this.rounds) {
            round.dealer = dIndex;
            dIndex = this.players.nextUnkicked(dIndex);
        }

        this.players.updateRounds(this.rounds, this.roundNumber);
    }

    getDealer() {
        return this.rounds[this.roundNumber].dealer;
    }

    getHandSize() {
        return this.rounds[this.roundNumber].handSize;
    }

    sendDealerLeader() {
        this.players.sendDealerLeader(this.getDealer(), this.leader);
    }

    deal() {
        this.deck.initialize();
        this.seen = new SeenCollection([], this.options.D);

        let hands = this.getNextHands();

        this.trump = hands.trump[0];
        this.trumps.push(this.trump);
        this.seen.add(this.trump);

        this.turn = this.players.nextUnkicked(this.getDealer());
        this.leader = this.turn;

        this.leaders.push([]);
        this.winners.push([]);

        this.players.newRound();
        this.sendDealerLeader();
        this.players.giveHands(hands);

        this.playNumber = 0;

        this.transitionFromDeal();
    }

    finishRound() {
        this.players.scoreRound();
        this.rounds[this.roundNumber].isOver = true;
        this.roundNumber++;

        this.transitionFromRoundEnd();
    }

    sendPostGame() {
        this.state = CoreState.POSTGAME;

        // win %
        let winningScore = Math.max(...this.players.players.map(p => p.score))
        let wb = new ml.BagModel(`./models/N${this.players.size()}/D${this.options.D}/T0/wb.txt`);
        for (let j = 0; j < this.rounds.length; j++) {
            if (j >= this.players.players[0].scores.length) {
                break;
            }

            let v = new ml.BasicVector(this.players.players.map(p => p.scores[j]).concat([this.rounds.length - 1 - j]));
            let wbProbs = j == this.rounds.length - 1 ?
                this.players.players.map(p => p.score == winningScore ? 1 : 0) :
                wb.evaluate(v).toArray();
            this.players.addWbProbs(wbProbs);
        }

        let json = {
            mode: this.game.mode,
            id: this.game.id,
            options: this.options.toDict(),
            rounds: this.rounds,
            trumps: this.trumps.map(c => c.toDict()),
            leaders: this.leaders,
            winners: this.winners,
            claims: this.claims,
            ...this.players.postGameData()
        };
        this.game.publishJson(json);
        this.players.sendPostGameData(json);
    }

    incomingChat(index, text) {
        this.players.sendChat(index, text);
    }

    replaceWithRobot(index, indexTarget) {
        if (this.players.get(index) !== this.game.host || !this.players.get(indexTarget).disconnected) {
            return;
        }

        this.players.replaceWithRobot(indexTarget);
    }

    poke(index) {
        this.players.players[index].poke();
    }

    incomingClaim(index) {
        if (this.state != CoreState.PLAYING || this.claimer !== undefined) {
            return;
        }

        this.claimer = index;
        this.players.announceClaim(index);

        if (this.players.players.filter(p => !p.human || p.replacedByRobot).length) {
            if (!this.hasColdClaim(index)) {
                this.respondToClaim(-1, false);
                return;
            }
        }

        this.respondToClaim(index, true); // claimer auto-accepts
    }

    respondToClaim(index, accept) {
        if (this.claimer === undefined) {
            return;
        }

        this.players.respondToClaim(index, accept);
    }

    acceptClaim() {
        this.claims.push(this.claimer);
        this.claimer = undefined;
        this.doNextRound();
    }

    reteam(requester, index, number) {
        let requesterPlayer = this.players.players[requester];
        if (requester != index && !requesterPlayer.host) {
            log('ERROR: Player "' + requesterPlayer.id + '" attempted to reteam someone else, but they are not host.');
            return;
        }

        this.players.reteam(index, number);
    }

    scrambleTeams(requester) {
        if (debug) {
            this.players.reteam(1, 1);
            this.players.reteam(2, 0);
            this.players.reteam(3, 2);
            this.players.reteam(4, 1);
            this.players.reteam(5, 2);
            this.players.reteam(0, 0);
            return;
        }

        let requesterPlayer = this.players.players[requester];
        if (!requesterPlayer.host) {
            log('ERROR: Player "' + requesterPlayer.id + '" attempted to scramble teams, but they are not host.');
            return;
        }

        this.players.scrambleTeams();
    }

    // standard
    whatCanIPlay(index) {
        let led = this.trickOrder.getLed();
        let hand = this.players.players[index].hand;
        if (led == -1) {
            return hand;
        } else {
            let ans = hand.filter(c => c.suit == led);
            if (ans.length == 0) {
                return hand;
            } else {
                return ans;
            }
        }
    }

    getTrump() {
        return this.trump;
    }

    getLeader() {
        return this.leader;
    }

    getLead() {
        return this.players.players[this.leader].trick;
    }
}

// Oh Hell
class OhHellCore extends Core {
    constructor(players, game) {
        super(players, game);
    }

    verifyGameCanStart() {
        let N = this.players.players.filter(p => p.human).length + this.options.robots;
        return N >= 2 && N <= 10;
    }

    transitionFromStart() {
        this.deal();
    }

    getNextHands() {
        let deal = undefined;

        if (debug) {
            deal = this.fullDeals[this.roundNumber];
        } else {
            deal = this.deck.deal(this.players.size(), this.rounds[this.roundNumber].handSize, true);
        }

        return {
            hands: deal.slice(0, this.players.size()),
            trump: deal[this.players.size()]
        };
    }

    buildRounds() {
        this.rounds = [];

        //this.rounds.push({dealer: 0, handSize: 1, isOver: false});
        //this.rounds.push({dealer: 0, handSize: 1, isOver: false});

        let maxH = Math.min(10, Math.floor(51 * this.options.D / this.players.size()));
        for (let i = maxH; i >= 2; i--) {
            this.rounds.push({dealer: 0, handSize: i, isOver: false});
        }
        for (let i = 0; i < this.players.size(); i++) {
            this.rounds.push({dealer: 0, handSize: 1, isOver: false});
        }
        for (let i = 2; i <= maxH; i++) {
            this.rounds.push({dealer: 0, handSize: i, isOver: false});
        }
    }

    transitionFromDeal() {
        this.state = CoreState.BIDDING;
        this.players.communicateTurn(this.state, this.turn);
    }

    incomingBid(index, bid) {
        let player = this.players.get(index);

        if (index != this.turn) {
            log('ERROR: Player "' + player.id + '" attempted to bid out of turn.');
            return;
        } else if (this.state != CoreState.BIDDING) {
            log('ERROR: Player "' + player.id + '" attempted to bid, but the game is not in bidding state.');
            return;
        } else if (bid < 0 || bid > this.getHandSize()) {
            log('ERROR: Player "' + player.id + '" attempted to bid ' + bid + ' with a hand size of ' + this.getHandSize() + '.');
            return;
        } else if (bid == this.whatCanINotBid(index)) {
            log('ERROR: Player "' + player.id + '" attempted to bid what they cannot bid as dealer.');
            return;
        }

        this.players.bidReport(index, bid);

        this.turn = this.players.nextUnkicked(this.turn);

        let data = {canPlay: undefined};
        if (this.players.allHaveBid()) {
            this.state = CoreState.PLAYING;
            this.trickOrder = new TrickOrder(this.trump.suit);
            data.canPlay = this.whatCanIPlay(this.turn);
        }

        this.players.communicateTurn(this.state, this.turn, data);
    }

    incomingPlay(index, card) {
        let player = this.players.get(index);

        if (index != this.turn) {
            log('ERROR: Player "' + player.id + '" attempted to play out of turn.');
            return;
        } else if (this.state != CoreState.PLAYING) {
            log('ERROR: Player "' + player.id + '" attempted to play, but the game is not in playing state.');
            return;
        } else if (!player.hand.some(c => c.matches(card))) {
            log('ERROR: Player "' + player.id + '" attempted to play ' + card.toString() + ', but they do not have that card.');
            return;
        } else if (!this.whatCanIPlay(index).filter(c => c.matches(card)).length) {
            log('ERROR: Player "' + player.id + '" attempted to play ' + card.toString() + ', failing to follow suit.');
            return;
        }

        this.seen.add(card);

        this.trickOrder.push(card, index);

        this.players.playReport(index, card, index == this.leader, this.getLead().suit);

        this.turn = this.players.nextUnkicked(this.turn);

        if (!this.players.allHavePlayed()) {
            this.players.communicateTurn(this.state, this.turn, {canPlay: this.whatCanIPlay(this.turn)});
        } else {
            this.turn = this.trickOrder.getWinner();
            this.winners[this.winners.length - 1].push(this.turn);
            this.leaders[this.leaders.length - 1].push(this.leader);
            this.leader = this.turn;
            this.players.trickWinner(this.turn);
            this.trickOrder = new TrickOrder(this.trump.suit);
            this.playNumber++;

            if (!this.players.hasEmptyHand(this.turn)) {
                this.players.communicateTurn(this.state, this.turn, {canPlay: this.whatCanIPlay(this.turn)});
            } else {
                this.claims.push(-1);
                this.finishRound();
            }
        }
    }

    transitionFromRoundEnd() {
        if (this.roundNumber < this.rounds.length) {
            this.deal();
        } else {
            this.sendPostGame();
        }
    }

    hasColdClaim(index) {
        // reject if player is not on lead
        // TODO do something better
        if (index != this.leader || index != this.turn) {
            return false;
        }

        let allHands = new Array(this.players.size());
        for (const player of this.players.players) {
            let suits = [[], [], [], []];
            for (const card of player.hand) {
                if (player.index == index) {
                    suits[card.suit].push(card);
                } else {
                    suits[card.suit].unshift(card);
                }
            }
            allHands[player.index] = suits;
        }

        for (let j = 0; j < 4; j++) {
            if (j == this.trump.suit && Math.max(...allHands.map(suits => suits[j].length)) != allHands[index][j].length) {
                return false;
            }

            while (allHands[index][j].length > 0) {
                let myBest = allHands[index][j].pop();
                for (let i = 0; i < this.players.size(); i++) {
                    if (i == index || allHands[i][j].length == 0) {
                        continue;
                    }

                    let yourBest = allHands[i][j][allHands[i][j].length - 1];
                    if (myBest.comp(yourBest, this.trump.suit, myBest.suit) != 1) {
                        return false;
                    }

                    allHands[i][j].pop();
                }
            }
        }
        return true;
    }

    score(player) {
        let bid = this.options.teams ? this.players.teams[player.team].bid() : player.bid;
        let taken = this.options.teams ? this.players.teams[player.team].taken() : player.taken;
        return this.scoreFunc(bid, taken);
    }

    scoreFunc(bid, taken) {
        if (bid == taken) {
            return 10 + bid * bid;
        } else {
            let d = Math.abs(bid - taken);
            return -5 * d * (d + 1) / 2;
        }
    }

    // data for ai
    whatCanINotBid(index) {
        if (index != this.getDealer()) {
            return -1;
        } else {
            return this.getHandSize() - this.players.bidSum();
        }
    }

    highestMakeableBid(index, considerDealer) {
        let handSize = this.rounds[this.roundNumber].handSize;
        if (this.options.teams) {
            let team = this.players.players[index].team;
            let totalBid = 0;
            let ourBid = 0;
            this.players.players.forEach(p => {
                totalBid += p.bid;
                if (p.team == team) {
                    ourBid += p.bid;
                }
            });

            let dealerOnOurTeam = this.players.players[this.getDealer()].team == team;

            return Math.max(
                handSize - ourBid - (considerDealer && totalBid == ourBid && dealerOnOurTeam ? 1 : 0),
                0
            );
        } else {
            return handSize;
        }
    }

    getTrickCollection() {
        return new SeenCollection(this.players.players.map(p => p.trick), this.options.D);
    }

    getHandCollection(index) {
        return new SeenCollection(this.players.players[index].hand, this.options.D);
    }

    getCardsPlayedCollection(index) {
        let p = this.players.players[index];
        return new SeenCollection(p.plays[p.plays.length - 1].concat([this.trump]), this.options.D);
    }

    getSeenCollection() {
        return this.seen;
    }

    wants(index) {
        let player = this.players.players[index];
        let h = this.players.players[index].hand.length;

        if (!player.bidded) {
            return -1;
        }

        let myWants = player.bid - player.taken;
        myWants = Math.max(Math.min(myWants, h), 0);

        if (this.options.teams) {
            let teamWants = this.teamWants(player.team);
            myWants = Math.min(myWants, teamWants);
            if (teamWants == h) {
                myWants = teamWants;
            }
        }

        return myWants;
    }

    teamWants(number) {
        let team = this.players.teams[number];
        return Math.max(Math.min(
            team.bid() - team.taken(),
            this.rounds[this.roundNumber].handSize
        ), 0);
    }

    // TODO think about improving this by giving better information about the leader
    // potentially winning after getting canceled.
    cancelsRequired(index, card) {
        let trick = this.trickOrder;
        if (card !== undefined) {
            trick = trick.copy();
            trick.push(card, index);
        }

        let N = this.players.size();
        let ans = new Array(N);
        if (trick.order.length == 0) {
            ans[trick.leader] = 0;
        }

        //log(trick.order.map(e => [e.index, e.card.toString()]));

        let handSet = new Set();
        if (index !== undefined) {
            this.players.players[index].hand.filter(c => c !== card).forEach(c => handSet.add(c.toNumber()));
        }

        let i = 0;
        let max = (this.leader - this.turn + N - 1) % N;
        for (const entry of trick.order) {
            ans[entry.index] = i;

            if (this.options.D == 1) {
                break;
            }

            let uncancelableBecauseSeen = this.seen.matchesLeft(entry.card) == 0;
            let uncancelableBecauseInHand = handSet.has(entry.card.toNumber());
            if (uncancelableBecauseSeen || uncancelableBecauseInHand || i == max) {
                break;
            }

            i++;
        }

        for (i = 0; i < N; i++) {
            let j = (i + this.leader) % N;
            if (ans[j] === undefined) {
                if (i <= (this.turn - this.leader + N) % N) {
                    ans[j] = -2;
                } else {
                    ans[j] = -1;
                }
            }
        }

        return ans;
    }
}

class TrickOrder {
    constructor(trump) {
        this.order = [];
        this.trump = trump;
        this.led = -1;
        this.leader = undefined;
    }

    copy() {
        let ans = new TrickOrder(this.trump);
        ans.led = this.led;
        ans.leader = this.leader;
        ans.order = this.order.map(e => e);
        return ans;
    }

    getLed() {
        return this.led;
    }

    push(card, index) {
        let entry = {card: card, index: index};

        if (this.led == -1) {
            this.order.push(entry);
            this.led = card.suit;
            this.leader = index;
            return;
        }

        if (card.suit != this.led && card.suit != this.trump) {
            return;
        }

        for (let i = 0; i < this.order.length; i++) {
            let comp = card.comp(this.order[i].card, this.trump, this.led);
            if (comp < 0) {
                continue;
            } else if (comp > 0) {
                this.order.splice(i, 0, entry);
                return;
            } else {
                this.order.splice(i, 1);
                return;
            }
        }
        this.order.push(entry);
    }

    getWinner() {
        if (this.order.length == 0) {
            return this.leader;
        } else {
            return this.order[0].index;
        }
    }
}

class SeenCollection {
    constructor(init, D) {
        this.D = D;
        this.initialize();
        for (const card of init) {
            this.add(card);
        }
    }

    initialize() {
        this.tracker = [new Array(13), new Array(13), new Array(13), new Array(13)];
        for (let val = 0; val < 13; val++) {
            for (let suit = 0; suit < 4; suit++) {
                this.tracker[suit][val] = val * this.D;
            }
        }
        this.counts = {};
    }

    add(card) {
        if (card === undefined || card.isEmpty()) {
            return;
        }

        for (let val = 0; val <= card.num - 2; val++) {
            this.tracker[card.suit][val]++;
        }

        let id = card.toNumber();
        if (this.counts[id] === undefined) {
            this.counts[id] = 1;
        } else {
            this.counts[id]++;
        }
    }

    cardValue(card) {
        return this.tracker[card.suit][card.num - 2];
    }

    cardsLeftOfSuit(suit) {
        return 13 * this.D - this.tracker[suit][0];
    }

    matchesLeft(card) {
        let count = this.counts[card.toNumber()];
        if (count === undefined) {
            count = 0;
        }
        return this.D - count;
    }

    // beware: the collections need to be disjoint for this to work
    merge(col) {
        for (let suit = 0; suit < 4; suit++) {
            let newCount = 13 * this.D;
            let leftCount = 13 * this.D;
            let rightCount = 13 * this.D;
            for (let val = 12; val >= 0; val--) {
                newCount -= (leftCount - this.tracker[suit][val]) + (rightCount - col.tracker[suit][val]) - this.D;
                leftCount = this.tracker[suit][val];
                rightCount = col.tracker[suit][val];
                this.tracker[suit][val] = newCount;
            }
        }

        for (const [id, count] of Object.entries(col.counts)) {
            if (this.counts[id] === undefined) {
                this.counts[id] = count;
            } else {
                this.counts[id] += count;
            }
        }
    }

    toArray() {
        let arr = [];
        for (let suit = 0; suit < 4; suit++) {
            let count = 13 * this.D;
            for (let val = 12; val >= 0; val--) {
                for (let c = 0; c < this.D - (count - this.tracker[suit][val]); c++) {
                    arr.push(new Card(val + 2, suit));
                }
                count = this.tracker[suit][val];
            }
        }
        return arr;
    }
}

// Oregon Hearts
class OregonHeartsCore extends Core {
    constructor(players, game) {
        super(players, game);
    }

    verifyGameCanStart() {
        let N = this.players.players.filter(p => p.human).length + this.options.robots;
        return N >= 3 && N <= 8;
    }

    transitionFromStart() {
        let cardsToRemove = [];
        switch (this.players.size()) {
            case 3:
                cardsToRemove = [new Card(2, 0)];
                break;
            case 5:
                cardsToRemove = [new Card(2, 0), new Card(2, 1)];
                break;
            case 6:
                cardsToRemove = [new Card(2, 0), new Card(2, 1), new Card(2, 2), new Card(2, 3)];
                break;
            case 7:
                cardsToRemove = [new Card(2, 0), new Card(2, 1), new Card(2, 2)];
                break;
            case 8:
                cardsToRemove = [new Card(2, 0), new Card(2, 1), new Card(2, 2), new Card(2, 3)];
                break;
        }
        this.deck.initialize = function () {
            this.deck = []
            for (let d = 1; d <= this.D; d++) {
                for (let suit = 0; suit < 4; suit++) {
                    for (let num = 2; num <= 14; num++) {
                        this.deck.push(new Card(num, suit));
                    }
                }
            }
            this.deck = this.deck.filter(c1 => cardsToRemove.filter(c2 => c1.matches(c2)).length == 0);
        }

        this.deal();
    }

    getNextHands() {
        return {
            hands: this.deck.deal(this.players.size(), this.rounds[this.roundNumber].handSize, false),
            trump: [new Card()]
        };
    }

    buildRounds() {
        this.rounds = [];

        for (let i = 0; i < this.players.size(); i++) {
            this.addARound(i)
        }
    }

    addARound(number) {
        let i = (number + 1) % this.players.size();
        let pass = -Math.pow(-1, i) * Math.floor((i + 1) / 2);
        this.rounds.push({dealer: 0, handSize: Math.floor(52 / this.players.size()), pass: pass});
    }

    transitionFromDeal() {
        if (this.rounds[this.roundNumber].pass == 0) {
            this.transitionToPlay()
        } else {
            this.state = CoreState.PASSING;
            this.players.communicateTurn(this.state, this.turn);
        }
    }

    incomingPass(index, cards) {
        let player = this.players.get(index);

        if (this.state != CoreState.PASSING) {
            log('ERROR: Player "' + player.id + '" attempted to pass, but the game is not in passing state.');
            return;
        } else if (cards.some(c1 => player.hand.filter(c2 => c2.matches(c1)).length == 0)) {
            log('ERROR: Player "' + player.id + '" attempted to pass [' + cards + '], but they do not have all of those cards.');
            return;
        } else if (cards.length != this.howManyToPass() && cards.length != 0) {
            log('ERROR: Player "' + player.id + '" attempted to pass ' + this.howManyToPass() + ' cards.');
            return;
        }

        this.players.passReport(index, cards);

        if (this.players.allHavePassed()) {
            this.transitionToPlay();
        }
    }

    transitionToPlay() {
        this.players.performPass(this.rounds[this.roundNumber].pass);
        this.state = CoreState.PLAYING;

        for (const player of this.players.players) {
            if (player.hand.filter(c => c.matches(this.getLeadCard())).length) {
                this.turn = player.index;
                this.leader = player.index;
                break;
            }
        }

        this.firstTrick = true;
        this.heartsBroken = false;
        this.players.communicateTurn(this.state, this.turn, {canPlay: this.whatCanIPlay(this.turn)});
    }

    incomingPlay(index, card) {
        let player = this.players.get(index);

        if (index != this.turn) {
            log('ERROR: Player "' + player.id + '" attempted to play out of turn.');
            return;
        } else if (this.state != CoreState.PLAYING) {
            log('ERROR: Player "' + player.id + '" attempted to play, but the game is not in playing state.');
            return;
        } else if (!player.hand.some(c => c.matches(card))) {
            log('ERROR: Player "' + player.id + '" attempted to play ' + card.toString() + ', but they do not have that card.');
            return;
        } else if (!this.whatCanIPlay(index).filter(c => c.matches(card)).length) {
            log('ERROR: Player "' + player.id + '" attempted to play ' + card.toString() + ', which is illegal.');
            return;
        }

        if (card.suit == 3) {
            this.heartsBroken = true;
        }

        let prev = (index + this.players.size() - 1) % this.players.size();
        let follow = this.players.players[prev].trick.suit;
        this.players.playReport(index, card, index == this.leader, follow);

        this.turn = this.players.nextUnkicked(this.turn);

        if (!this.players.allHavePlayed()) {
            this.players.communicateTurn(this.state, this.turn, {canPlay: this.whatCanIPlay(this.turn)});
        } else {
            this.turn = this.getWinner();
            this.winners[this.winners.length - 1].push(this.turn);
            this.leaders[this.leaders.length - 1].push(this.leader);
            this.leader = this.turn;
            this.players.trickWinner(this.turn);
            this.trickOrder = new TrickOrder(-1);
            this.playNumber++;
            this.firstTrick = false;

            if (!this.players.hasEmptyHand(this.turn)) {
                this.players.communicateTurn(this.state, this.turn, {canPlay: this.whatCanIPlay(this.turn)});
            } else {
                this.claims.push(-1);
                this.finishRound();
            }
        }
    }

    getWinner() {
        let prev = (this.leader + this.players.size() - 1) % this.players.size();
        let suit = this.players.players[prev].trick.suit;
        let winner = -1;
        let max = 0;
        for (const player of this.players.players) {
            if (player.trick.suit == suit && player.trick.num > max) {
                winner = player.index;
                max = player.trick.num;
            }
        }
        return winner;
    }

    score(player) {
        let hearts = 0;
        let queen = false;
        for (const card of player.cardsTaken) {
            if (card.suit == 3) {
                hearts++;
            } else if (card.suit == 2 && card.num == 12) {
                queen = true;
            }
        }

        let points = hearts == 0 && !queen ? 10 : hearts + (queen ? 13 : 0);

        if (player.score + points == 100) {
            points = -player.score;
        } // TODO shooting?

        return points;
    }

    transitionFromRoundEnd() {
        if (this.players.players.some(p => p.score > 100)) {
            this.sendPostGame();
        } else {
            if (this.roundNumber == this.rounds.length) {
                this.addARound(this.roundNumber);
                this.updateRounds();
            }
            this.deal();
        }
    }

    // data for ai
    howManyToPass() {
        let ans = [0, 0, 0, 4, 3, 2, 2, 2, 1];
        return ans[this.players.size()];
    }

    whatCanIPlay(index) {
        let hand = this.players.players[index].hand;

        // if first trick, must lead 3C or 2C
        if (this.firstTrick) {
            let leadCard = this.getLeadCard();
            let lead = hand.filter(c => c.matches(leadCard));
            if (lead.length) {
                return lead;
            }
        }

        let prev = (index + this.players.size() - 1) % this.players.size();
        let follow = index == this.leader ? -1 : this.players.players[prev].trick.suit;
        if (follow == -1) { // leading

            // check if hearts broken
            if (!this.heartsBroken) {
                let nonhearts = hand.filter(c => c.suit != 3);
                if (nonhearts.length > 0) {
                    return nonhearts;
                }
            }

            return hand;
        } else { // following
            let ans = hand.filter(c => c.suit == follow);
            if (ans.length == 0) {
                ans = hand;
            }

            // don't play points on first round unless you have to
            if (this.firstTrick) {
                let nonpoints = ans.filter(c => c.suit != 3 && !(c.suit == 2 && c.num == 12));
                if (nonpoints.length > 0) {
                    return nonpoints;
                }
            }

            return ans;
        }
    }

    getLeadCard() {
        return new Card(this.players.size() == 4 ? 2 : 3, 0);
    }
}

// Options
class Options {
    constructor() {
        this.robots = 0;
        this.D = 1;
        this.teams = false;
    }

    toDict() {
        return {
            robots: this.robots,
            D: this.D,
            teams: this.teams
        };
    }

    update(options) {
        this.robots = parseInt(options.robots);
        this.D = options.D;
        this.teams = options.teams;
    }
}
