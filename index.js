var debug = false;

var express = require("express");
var socket = require("socket.io");
var fs = require('fs');
var ai = require('./ai');
var ml = require('./ml');

// App setup
var app = express();
var port = 80;
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

function addUser(user) {
    userDict[user.socket.id] = user;
    user.confirmLogin();
}

function removeUser(user) {
    delete userDict[user.socket.id];
    user.confirmLogout();
}

io.on("connection", function (socket) {
    console.log(`socket ${socket.id} connected at address ${socket.handshake.address}.`);

    socket.on("login", function (data) {
        let user = new User(socket, data.id);
        addUser(user);
        console.log(`user ${user.id} at socket ${socket.id}.`);
    });
    socket.on("logout", function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to logout, but they are not in the user dict.`);
            return;
        }

        console.log("logout", user.id);
        removeUser(user);
    });
    socket.on("disconnect", function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`socket ${socket.id} disconnected.`);
            return;
        }

        console.log(`user ${user.id} disconnected.`);

        if (user.player) {
            user.game.disconnectPlayer(user, false);
        }
        removeUser(user);
    });

    socket.on('gamelist', () => {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} requested the game list, but they are not in the user dict.`);
            return;
        }

        user.sendGameList();
    });

    socket.on('creatempgame', () => {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to create a multiplayer game, but they are not in the user dict.`);
            return;
        }

        let game = new OhHellGame(true);
        gameDict[game.id] = game;
        game.joinPlayer(user);

        console.log(`new multiplayer game: ${game.id}, hosted by ${user.id}.`);
    });
    socket.on('createspgame', () => {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to create a single player game, but they are not in the user dict.`);
            return;
        }

        let game = new OhHellGame(false);
        gameDict[game.id] = game;
        game.joinPlayer(user);

        console.log(`new single player game: ${game.id}, hosted by ${user.id}.`);
    });
    socket.on('joinmpgame', id => {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to join game ${id}, but they are not in the user dict.`);
            return;
        }

        let game = gameDict[id];

        if (game === undefined) {
            console.log(`ERROR: user ${user.id} tried to join game ${id}, but that game does not exist.`);
            return;
        }

        game.joinPlayer(user);

        console.log(`${user.id} joined game ${game.id}.`);
    });
    socket.on('leavegame', () => {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to leave game, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (game === undefined) {
            console.log(`ERROR: user ${user.id} tried to join game, but they are not in a game.`);
            return;
        }

        user.game.disconnectPlayer(user);

        console.log(`${user.id} left game ${game.id}.`);
    });

    socket.on('player', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to update player, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to update player, but they are not in a game.`);
            return;
        }

        game.players.updatePlayer(data);
    });
    socket.on('options', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to update options, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to update options, but they are not in a game.`);
            return;
        }

        game.core.updateOptions(data);
    });
    socket.on('start', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to start a game, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to start a game, but they are not in a game.`);
            return;
        }

        game.core.startGame();
    });
    socket.on('end', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to end a game, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to end a game, but they are not in a game.`);
            return;
        }

        game.core.endGame(user.player.getIndex());
    });
    socket.on('bid', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to bid, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to bid, but they are not in a game.`);
            return;
        }

        game.core.incomingBid(user.player.getIndex(), data.bid);
        user.player.readiedBid = undefined;
    });
    socket.on('play', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to play, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to play, but they are not in a game.`);
            return;
        }

        game.core.incomingPlay(user.player.getIndex(), new Card(data.card.num, data.card.suit));
        user.player.readiedPlay = undefined;
    });
    socket.on('chat', function (data) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to chat, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to chat, but they are not in a game.`);
            return;
        }

        game.core.incomingChat(user.player.getIndex(), data);
    });
    socket.on('replacewithrobot', function (index) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to replace with robot, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to replace with robot, but they are not in a game.`);
            return;
        }

        game.core.replaceWithRobot(user.player.getIndex(), index);
    });
    socket.on('poke', function (index) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to poke someone, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to poke someone, but they are not in a game.`);
            return;
        }

        game.core.poke(index);
    });
    socket.on('claim', function () {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to claim, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to claim, but they are not in a game.`);
            return;
        }

        game.core.incomingClaim(user.player.getIndex());
    });
    socket.on('claimresponse', function (accept) {
        let user = userDict[socket.id];

        if (user === undefined) {
            console.log(`ERROR: socket ${socket.id} tried to respond to a claim, but they are not in the user dict.`);
            return;
        }

        let game = user.game;

        if (!user.game) {
            console.log(`ERROR: user ${user.id} tried to respond to a claim, but they are not in a game.`);
            return;
        }

        game.core.respondToClaim(user.player.getIndex(), accept);
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

        let games = Object.values(gameDict).filter(g => g.public);
        this.socket.emit('gamelist', {
            games: games.map(g => g.toDict())
        });
    }
}

// Game
class OhHellGame {
    constructor(pub) {
        this.id = new Date().getTime();
        this.public = pub;
        this.players = new PlayersList(this);
        this.host = undefined;
        this.core = new Core(this.players, this);
    }

    toDict() {
        let inGame = this.core.state == CoreState.BIDDING || this.core.state == CoreState.PLAYING;
        return {
            id: this.id,
            public: this.public,
            type: 'Oh Hell',
            host: this.host ? this.host.id : '',
            players: this.players.players.filter(p => p.isHuman()).length,
            state: inGame ? 'In game' : 'In lobby'
        };
    }

    joinPlayer(user) {
        let player = new HumanPlayer(user, this.core);
        player.setName(user.id);

        if (this.host === undefined) {
            this.host = player;
        }
        player.setHost(this.host === player);

        user.player = player;
        user.game = this;

        player.commandJoin(this.id);
        this.players.addPlayer(player);
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

    dispose() {
        delete gameDict[this.id];
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

    deal(N, h) {
        if (N * h + 1 > 52 * this.D) {
            console.log('ERROR: tried to deal ' + h + ' cards to ' + N + ' players.');
        }

        let out = [];

        // Shuffle in place
        for (let i = 52 * this.D - 1; i > 0; i--) {
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
        out.push([this.deck[h * N]]);

        return out;
    }
}

// Player
class Player {
    constructor() {
        this.kibitzer = false;
        this.replacedByRobot = false;
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

    setName(name) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    setId(id) {
        this.id = id;
    }

    getId() {
        return this.id;
    }

    isHuman() {
        return this.human;
    }

    isDisconnected() {
        return this.disconnected;
    }

    setKibitzer(kib) {
        this.kibitzer = kib;
    }

    isKibitzer() {
        return this.kibitzer;
    }

    setHost(host) {
        this.host = host;
    }

    isHost() {
        return this.host;
    }

    setIndex(index) {
        this.index = index;
    }

    getIndex() {
        return this.index;
    }

    setStrategyModule(module) {
        this.strategyModule = module;
    }

    setHand(hand) {
        this.hand = hand;
    }

    getHand(hand) {
        return this.hand;
    }

    hasBid() {
        return this.bidded;
    }

    getBid() {
        return this.bid;
    }

    getTaken() {
        return this.taken;
    }

    getScore() {
        return this.score;
    }

    getTrick() {
        return this.trick;
    }

    getBids() {
        return this.bids;
    }

    getScores() {
        return this.scores;
    }

    getTakens() {
        return this.takens;
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
        this.lastTrick = new Card();
        this.acceptedClaim = false;
        this.plays.push([]);

        this.makingProbs.push([]);
        this.roundMistakes = 0;
    }

    newTrickReset() {
        this.lastTrick = this.trick;
        this.trick = new Card();
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
    commandStart() {}
    commandBid(data) {}
    bidReady(bid) {}
    commandPlay(data) {}
    playReady(card) {}
    commandDeal(data) {}
    commandTrickWinner(data) {}
}

class PlayersList {
    constructor(game) {
        this.game = game;
        this.players = [];
        this.kibitzers = [];
    }

    toDict(index) {
        if (arguments.length == 0) {
            index = -1;
        }
        return {
            info: this.players.map(p => p.toDict()),
            hands: this.players.map(p => p.getHand().map(c => (index == -1 || p.getIndex() == index ? c : new Card()).toDict())),
            bids: this.players.map(p => p.getBids()),
            takens: this.players.map(p => p.getTakens()),
            scores: this.players.map(p => p.getScores())
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
            if (p.getId() == player.getId()) {
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
                player.setIndex(this.players.length);
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
            }
        } else {
            if (!reconnect) {
                this.kibitzers.push(player);
                player.setKibitzer(true);
            }
            let allData = {
                players: this.players.map(p => p.toDict())
            };
            player.commandAddPlayers(allData);
            player.commandStart();
            player.commandGameState(this.core.toDict(player.isKibitzer() ? -1 : player.getIndex()));
        }

        this.game.stopExpirationTimer();
    }

    addRobots(robots) {
        for (const player of robots) {
            player.setIndex(this.players.length);
            this.players.push(player);
        }

        let allData = {players: robots.map(p => p.toDict())};
        this.emitAll('addplayers', allData);
    }

    attachStrategyModules(modules) {
        for (let i = 0; i < modules.length; i++) {
            this.players[i].setStrategyModule(modules[i]);
            modules[i].setCoreAndPlayer(this.core, this.players[i]);
        }
    }

    getRobots() {
        return this.players.filter(p => !p.isHuman());
    }

    disconnectPlayer(player, kick) {
        player.setDisconnected(true);

        if (player.isKibitzer()) {
            this.kibitzers = this.kibitzers.filter(p => p !== player);
        } else if (this.core.state == CoreState.PREGAME || this.core.state == CoreState.POSTGAME) {
            this.removePlayers([player]);

            if (this.players.filter(p => p.isHuman()).length == 0) {
                this.game.dispose();
            }
        } else {
            this.updatePlayers([player]);

            if (this.players.filter(p => p.isHuman() && !p.isDisconnected()).length == 0) {
                this.game.startExpirationTimer();
            }
        }

        if (this.game.host === player) {
            this.game.host = undefined;
            for (const p of this.players) {
                if (!p.isDisconnected() && p.isHuman()) {
                    this.game.host = p;
                    p.setHost(true);
                    this.updatePlayers([p]);
                }
            }
        }
    }

    removePlayers(players) {
        this.players = this.players.filter(p => !players.includes(p));
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].setIndex(i);
        }
        let playerData = {indices: players.map(p => p.getIndex())};
        for (const list of [this.players, this.kibitzers]) {
            for (const p of list) {
                p.commandRemovePlayers(playerData);
            }
        }
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

        if (!player.isKibitzer() && data.kibitzer) {
            this.players = this.players.filter(p => p !== player);
            this.kibitzers.push(player);
            for (let i = player.getIndex(); i < this.players.length; i++) {
                this.players[i].setIndex(i);
            }
            let playerData = {indices: [player.getIndex()]};
            for (const list of [this.players, this.kibitzers]) {
                for (const p of list) {
                    p.commandRemovePlayers(playerData);
                }
            }
        } else if (player.isKibitzer() && !data.kibitzer) {
            this.kibitzers = this.kibitzers.filter(p => p !== player);
            this.players.push(player);
            player.setIndex(this.players.length - 1);
            let playerData = {players: [player.toDict()]};
            for (const list of [this.players, this.kibitzers]) {
                for (const p of list) {
                    p.commandAddPlayers(playerData);
                }
            }
        }

        player.setName(data.name);
        player.setKibitzer(data.kibitzer);
        this.updatePlayers([player]);
    }

    updateOptions(options) {
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
            player.setIndex(i);
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
            player.addHand(hands[player.getIndex()]);
            player.commandDeal(hands);
        }
        for (const kibitzer of this.kibitzers) {
            kibitzer.commandDeal(hands);
        }
    }

    sendDealerLeader(dealer, leader) {
        this.emitAll('dealerleader', {dealer: dealer, leader: leader});
    }

    communicateTurn(state, turn) {
        if (state == CoreState.BIDDING) {
            for (const player of this.players) {
                player.startBid({turn: turn});
            }
            for (const player of this.kibitzers) {
                player.startBid({turn: turn});
            }
        } else if (state == CoreState.PLAYING) {
            for (const player of this.players) {
                player.startPlay({turn: turn});
            }
            for (const player of this.kibitzers) {
                player.startPlay({turn: turn});
            }
        }
    }

    bidSum() {
        let ans = 0;
        for (const player of this.players) {
            if (player.hasBid()) {
                ans += player.getBid();
            }
        }
        return ans;
    }

    bidReport(index, bid) {
        this.players[index].addBid(bid);
        this.emitAll('bidreport', {index: index, bid: bid});
    }

    playReport(index, card) {
        this.players[index].addPlay(card);
        this.emitAll('playreport', {index: index, card: {num: card.num, suit: card.suit}});
    }

    whatCanIPlay(index, led) {
        let hand = this.players[index].getHand();
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

    allHaveBid() {
        return !this.players.some(p => !p.hasBid());
    }

    allHavePlayed() {
        return !this.players.some(p => p.getTrick().isEmpty());
    }

    trickWinner(index) {
        this.players[index].incTaken();

        for (const player of this.players) {
            player.newTrickReset();
        }
        this.emitAll('trickwinner', {index: index});
    }

    hasEmptyHand(index) {
        return this.players[index].getHand().length == 0;
    }

    scoreRound() {
        let newScores = [];
        for (const player of this.players) {
            player.addTaken();
            let score = this.core.score(player.getBid(), player.getTaken());
            player.addScore(score);
            newScores.push(player.getScore());

            player.mistakes.push(player.roundMistakes);

            let qs = player.bidQs[player.bidQs.length - 1];
            let mu = ai.pointsMean(qs, player.getBid());
            let sig2 = ai.pointsVariance(qs, player.getBid());

            let luck = Math.min(5, Math.max(-5,
                (score - mu) / Math.sqrt(sig2)
            ));
            player.addLuck(sig2 == 0 ? 0 : luck);
        }
        this.emitAll('scoresreport', {scores: newScores});
    }

    addWbProbs(probs) {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].addWbProb(probs[i]);
        }
    }

    postGameData(coreData) {
        this.emitAll('postgame', {
            rounds: coreData.rounds,
            trumps: coreData.trumps,
            leaders: coreData.leaders,
            winners: coreData.winners,
            claims: coreData.claims,
            players: this.players.map(p => p.toPostGameDict())
        });
    }

    sendChat(index, text) {
        this.emitAll('chat', {sender: this.players[index].getName(), text: text});
    }

    sendEndGameRequest(index) {
        this.emitAll('end', {index: index});
    }

    replaceWithRobot(index) {
        this.players[index].replaceWithRobot();
        this.updatePlayers([this.players[index]]);
    }

    announceClaim(index) {
        this.emitAll('claim', {index: index, hand: this.players[index].getHand().map(c => c.toDict())});
    }

    respondToClaim(index, accept) {
        if (!accept) {
            this.emitAll('claimresult', {accepted: false, claimer: this.core.claimer});
            this.core.claimer = undefined;
        } else {
            this.players[index].acceptedClaim = true;
            if (this.players.filter(p => p.isHuman() && !p.replacedByRobot && !p.acceptedClaim).length == 0) {
                let winner = this.players[this.core.claimer];
                let remaining = winner.getHand().length;
                if (!winner.getTrick().isEmpty()) {
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

    commandStart() {
        this.user.socket.emit('start');
    }

    commandDeal(data) {
        if (this.kibitzer) {
            this.user.socket.emit('deal', data);
        } else {
            let copy = [];
            let empty = [];
            for (const c of data[0]) {
                empty.push({num: 0, suit: 0});
            }
            for (let i = 0; i < data.length; i++) {
                if (i == this.index || i == data.length - 1) {
                    copy.push(data[i].map(c => ({num: c.num, suit: c.suit})));
                } else {
                    copy.push(empty);
                }
            }
            this.user.socket.emit('deal', copy);
        }
    }

    commandBid(data) {
        this.user.socket.emit('bid', data);
    }

    commandPlay(data) {
        this.user.socket.emit('play', data);
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
}

// Core
var CoreStateEnum = function () {
    this.PREGAME = 0;
    this.BIDDING = 1;
    this.PLAYING = 2;
    this.POSTGAME = 3;
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
        let N = this.players.players.filter(p => p.isHuman()).length + this.options.robots;
        if (N <= 1 || N >= 11) {
            return;
        }

        this.removeRobots();
        this.addRobots();
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

        this.deal();
    }

    endGame(index) {
        if (index != this.game.host.getIndex()) {
            console.log('ERROR: Player "' + this.players.get(index).getId() + '" tried to end the game, but they are not host.');
            return;
        }

        this.players.sendEndGameRequest(index);
        this.sendPostGame();
    }

    randomizePlayerOrder() {}

    removeRobots() {
        let robots = this.players.getRobots();
        this.players.removePlayers(robots);
    }

    addRobots() {
        let robots = new Array(this.options.robots);
        for (let i = 0; i < this.options.robots; i++) {
            robots[i] = new AiPlayer(i + 1, this);
        }
        this.players.addRobots(robots);
    }

    attachStrategyModules() {
        let modules = ai.buildStrategyModules(
            this.players.size(),
            this.options.D
        );
        this.players.attachStrategyModules(modules);
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

    getNextHands() {
        if (debug) {
            return this.fullDeals[this.roundNumber];
        }

        return this.deck.deal(this.players.size(), this.rounds[this.roundNumber].handSize);
    }

    sendDealerLeader() {
        this.players.sendDealerLeader(this.getDealer(), this.leader);
    }

    deal() {
        this.deck.initialize();
        this.seen = new SeenCollection([], this.options.D);

        let hands = this.getNextHands();

        this.trump = hands[this.players.size()][0];
        this.trumps.push(this.trump);
        this.seen.add(this.trump);

        this.turn = this.players.nextUnkicked(this.getDealer());
        this.leader = this.turn;

        this.leaders.push([]);
        this.winners.push([]);

        this.players.newRound();
        this.sendDealerLeader();
        this.players.giveHands(hands);

        this.state = CoreState.BIDDING;

        this.players.communicateTurn(this.state, this.turn);
    }

    incomingBid(index, bid) {
        let player = this.players.get(index);

        if (index != this.turn) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to bid out of turn.');
            return;
        } else if (this.state != CoreState.BIDDING) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to bid, but the game is not in bidding state.');
            return;
        } else if (bid < 0 || bid > this.getHandSize()) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to bid ' + bid + ' with a hand size of ' + this.getHandSize() + '.');
            return;
        } else if (bid == this.whatCanINotBid(index)) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to bid what they cannot bid as dealer.');
            return;
        }

        this.players.bidReport(index, bid);

        this.turn = this.players.nextUnkicked(this.turn);

        if (this.players.allHaveBid()) {
            this.state = CoreState.PLAYING;
            this.trickOrder = new TrickOrder(this.trump.suit);
        }

        this.players.communicateTurn(this.state, this.turn);
    }

    incomingPlay(index, card) {
        let player = this.players.get(index);

        if (index != this.turn) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to play out of turn.');
            return;
        } else if (this.state != CoreState.PLAYING) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to play, but the game is not in playing state.');
            return;
        } else if (!player.getHand().some(c => c.matches(card))) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to play ' + card.toString() + ', but they do not have that card.');
            return;
        } else if (!this.whatCanIPlay(index).filter(c => c.matches(card)).length) {
            console.log('ERROR: Player "' + player.getId() + '" attempted to play ' + card.toString() + ', failing to follow suit.');
            return;
        }

        this.seen.add(card);

        this.trickOrder.push(card, index);

        this.players.playReport(index, card);

        this.turn = this.players.nextUnkicked(this.turn);

        if (!this.players.allHavePlayed()) {
            this.players.communicateTurn(this.state, this.turn);
        } else {
            this.turn = this.trickOrder.getWinner();
            this.winners[this.winners.length - 1].push(this.turn);
            this.leaders[this.leaders.length - 1].push(this.leader);
            this.leader = this.turn;
            this.players.trickWinner(this.turn);
            this.trickOrder = new TrickOrder(this.trump.suit);
            this.playNumber++;

            if (!this.players.hasEmptyHand(this.turn)) {
                this.players.communicateTurn(this.state, this.turn);
            } else {
                this.claims.push(-1);
                this.doNextRound();
            }
        }
    }

    doNextRound() {
        this.players.scoreRound();
        this.rounds[this.roundNumber].isOver = true;
        this.roundNumber++;
        this.playNumber = 0;
        if (this.roundNumber < this.rounds.length) {
            this.deal();
        } else {
            this.sendPostGame();
        }
    }

    sendPostGame() {
        this.state = CoreState.POSTGAME;

        // win %
        let winningScore = Math.max(...this.players.players.map(p => p.getScore()))
        let wb = new ml.BagModel(`./models/N${this.players.size()}/D${this.options.D}/T0/wb.txt`);
        for (let j = 0; j < this.rounds.length; j++) {
            if (j >= this.players.players[0].getScores().length) {
                break;
            }

            let v = new ml.BasicVector(this.players.players.map(p => p.getScores()[j]).concat([this.rounds.length - 1 - j]));
            let wbProbs = j == this.rounds.length - 1 ?
                this.players.players.map(p => p.getScore() == winningScore ? 1 : 0) :
                wb.evaluate(v).toArray();
            this.players.addWbProbs(wbProbs);
        }

        this.players.postGameData({
            rounds: this.rounds,
            trumps: this.trumps.map(c => c.toDict()),
            leaders: this.leaders,
            winners: this.winners,
            claims: this.claims
        });
    }

    score(bid, taken) {
        if (bid == taken) {
            return 10 + bid * bid;
        } else {
            let d = Math.abs(bid - taken);
            return -5 * d * (d + 1) / 2;
        }
    }

    incomingChat(index, text) {
        this.players.sendChat(index, text);
    }

    replaceWithRobot(index, indexTarget) {
        if (this.players.get(index) !== this.game.host || !this.players.get(indexTarget).isDisconnected()) {
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

        if (this.players.players.filter(p => !p.isHuman() || p.replacedByRobot).length) {
            if (!this.hasColdClaim(index)) {
                this.respondToClaim(-1, false);
                return;
            }
        }

        this.respondToClaim(index, true); // claimer auto-accepts
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
            for (const card of player.getHand()) {
                if (player.getIndex() == index) {
                    suits[card.suit].push(card);
                } else {
                    suits[card.suit].unshift(card);
                }
            }
            allHands[player.getIndex()] = suits;
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

    // data for ai
    whatCanINotBid(index) {
        if (index != this.getDealer()) {
            return -1;
        } else {
            return this.getHandSize() - this.players.bidSum();
        }
    }

    whatCanIPlay(index) {
        return this.players.whatCanIPlay(index, this.trickOrder.getLed());
    }

    getTrump() {
        return this.trump;
    }

    getTrickCollection() {
        return new SeenCollection(this.players.players.map(p => p.getTrick()), this.options.D);
    }

    getHandCollection(index) {
        return new SeenCollection(this.players.players[index].getHand(), this.options.D)
    }

    getSeenCollection() {
        return this.seen;
    }

    wants(index) {
        let player = this.players.players[index];
        let h = this.players.players[index].getHand().length;

        if (!player.hasBid()) {
            return -1;
        }

        let myWants = player.getBid() - player.getTaken();
        myWants = Math.max(Math.min(myWants, h), 0);

        return myWants;
    }

    cancelsRequired(index, card) {
        let trick = this.trickOrder;
        if (card !== undefined) {
            trick = trick.copy();
            trick.push(card, index);
        }

        let N = this.players.size();
        let ans = new Array(N);
        if (trick.order.length == 0) {
            ans[trick.leader] == 0;
        }

        //console.log(trick.order.map(e => [e.index, e.card.toString()]));

        let handSet = new Set();
        if (index !== undefined) {
            this.players.players[index].getHand().filter(c => c !== card).forEach(c => handSet.add(c.toNumber()));
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

    getLeader() {
        return this.leader;
    }

    getLead() {
        return this.players.players[this.leader].getTrick();
    }
}

class TrickOrderEntry {
    constructor(card, index) {
        this.card = card;
        this.index = index;
    }
}

class TrickOrder {
    constructor(trump) {
        this.order = [];
        this.trump = trump;
        this.led = -1;
    }

    copy() {
        let ans = new TrickOrder(this.trump);
        ans.led = this.led;
        for (const entry of this.order) {
            ans.order.push(entry);
        }
        return ans;
    }

    getLed() {
        return this.led;
    }

    push(card, index) {
        let entry = new TrickOrderEntry(card, index);

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
