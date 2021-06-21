var express = require("express");
var socket = require("socket.io");
var ai = require('./ai');

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
var playerDict = {};

io.on("connection", function (socket) {
    console.log("connected", socket.id);

    socket.on("join", function (data) {
        console.log("joined", data.id, socket.id);
        let player = new HumanPlayer(socket);
        joinPlayer(player, data.id);
    });
    socket.on("disconnect", function () {
        console.log("disconnected", socket.id);
        let player = playerDict[socket.id];
        if (player) {
            disconnectPlayer(playerDict[socket.id], false);
            delete playerDict[socket.id];
        }
    });
    socket.on('options', function (data) {
        core.updateOptions(data);
    });
    socket.on('start', function () {
        core.startGame();
    });
    socket.on('bid', function (data) {
        core.incomingBid(playerDict[socket.id].getIndex(), data.bid);
    });
    socket.on('play', function (data) {
        core.incomingPlay(playerDict[socket.id].getIndex(), new Card(data.card.num, data.card.suit));
    });
    socket.on('chat', function (data) {
        core.incomingChat(playerDict[socket.id].getIndex(), data);
    });
});

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
    }

    toDict() {
        return {
            name: this.name,
            id: this.id,
            human: this.human,
            host: this.host,
            disconnected: this.disconnected,
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

    setDisconnected(disc) {
        this.disconnected = disc;
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
    }

    newRoundReset() {
        this.bid = 0;
        this.taken = 0;
        this.bidded = false;
        this.trick = new Card();
        this.lastTrick = new Card();
    }

    newTrickReset() {
        this.lastTrick = this.trick;
        this.trick = new Card();
    }

    addBid(bid) {
        this.bid = bid;
        this.bidded = true;
        this.bids.push(bid);
    }

    addPlay(card) {
        this.trick = card;
        for (let i = 0; i < this.hand.length; i++) {
            if (this.hand[i].matches(card)) {
                this.hand.splice(i, 1);
            }
        }
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

    reconnect(player) {}

    commandGameState(data) {}
    commandAddPlayers(data) {}
    commandRemovePlayers(data) {}
    commandUpdatePlayers(data) {}
    commandStart() {}
    commandDeal(data) {}
    commandBid(date) {}
    commandPlay(date) {}
    commandTrickWinner(data) {}
}

class PlayersList {
    constructor() {
        this.players = []
        this.kibitzers = []
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
        for (const player of this.players) {
            if (player.human && player.socket.connected) {
                player.socket.emit(type, data);
            }
        }
        for (const kibitzer of this.kibitzers) {
            if (kibitzer.human && kibitzer.socket.connected) {
                kibitzer.socket.emit(type, data);
            }
        }
    }

    addPlayer(player) {
        // check if it's a reconnect
        let reconnect = false;
        for (const p of this.players) {
            if (p.getId() == player.getId()) {
                p.reconnect(player);
                p.setDisconnected(false);
                player = p;

                let playerData = {players: [player.toDict()]};
                for (const p1 of this.players) {
                    if (p1 !== player) {
                        p1.commandUpdatePlayers(playerData);
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
                for (const p of this.players) {
                    if (p !== player) {
                        p.commandAddPlayers(playerData);
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
            player.commandGameState(core.toDict(player.isKibitzer() ? -1 : player.getIndex()));
        }
    }

    addRobots(robots) {
        for (const player of robots) {
            player.setIndex(this.players.length);
            this.players.push(player);
        }

        let allData = {players: robots.map(p => p.toDict())};
        this.emitAll('addplayers', allData);
    }

    disconnectPlayer(player, kick) {
        player.setDisconnected(true);

        if (player.isKibitzer()) {
            this.kibitzers = this.kibitzers.filter(p => p !== player);
        } else if (core.state == CoreState.PREGAME || core.state == CoreState.POSTGAME) {
            this.players = this.players.filter(p => p !== player);
            for (let i = player.getIndex(); i < this.players.length; i++) {
                this.players[i].setIndex(i);
            }
            let playerData = {indices: [player.getIndex()]};
            for (const p of this.players) {
                p.commandRemovePlayers(playerData);
            }
        } else {
            this.updatePlayers([player]);
        }

        if (host === player) {
            host = undefined;
            if (this.players.length > 0) {
                host = this.players[0];
                host.setHost(true);
                this.updatePlayers([host]);
            }
        }
    }

    updatePlayers(players) {
        let data = {players: players.map(p => p.toDict())};
        for (const player of this.players) {
            player.commandUpdatePlayers(data);
        }
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
            player.setHand(hands[player.getIndex()]);
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
                player.commandBid({turn: turn});
            }
            for (const player of this.kibitzers) {
                player.commandBid({turn: turn});
            }
        } else if (state == CoreState.PLAYING) {
            for (const player of this.players) {
                player.commandPlay({turn: turn});
            }
            for (const player of this.kibitzers) {
                player.commandPlay({turn: turn});
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
            let score = core.score(player.getBid(), player.getTaken());
            player.addScore(score);
            newScores.push(player.getScore());
        }
        this.emitAll('scoresreport', {scores: newScores});
    }

    sendChat(index, text) {
        this.emitAll('chat', {sender: this.players[index].getName(), text: text});
    }
}

class HumanPlayer extends Player {
    constructor(socket) {
        super();
        this.socket = socket;
        playerDict[this.socket.id] = this;
        this.disconnected = false;
        this.human = true;
    }

    reconnect(player) {
        if (this.socket.connected) {
            this.socket.emit('kick');
        }

        this.socket = player.socket;
        playerDict[this.socket.id] = this;
    }

    commandJoin() {
        this.socket.emit('join');
    }

    commandGameState(data) {
        this.socket.emit('gamestate', data);
    }

    commandAddPlayers(data) {
        this.socket.emit('addplayers', data);
    }

    commandRemovePlayers(data) {
        this.socket.emit('removeplayers', data);
    }

    commandUpdatePlayers(data) {
        this.socket.emit('updateplayers', data);
    }

    commandStart() {
        this.socket.emit('start');
    }

    commandDeal(data) {
        if (this.kibitzer) {
            this.sock.emit('deal', data);
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
            this.socket.emit('deal', copy);
        }
    }

    commandBid(data) {
        this.socket.emit('bid', data);
    }

    commandPlay(data) {
        this.socket.emit('play', data);
    }

    commandTrickWinner(data) {
        this.socket.emit('trickwinner', data);
    }
}

class AiPlayer extends Player {
    constructor(i, core) {
        super();
        this.disconnected = false;
        this.human = false;
        this.id = '@robot' + i;
        this.name = 'bot ' + i;
        this.core = core;
    }

    setStrategyModule(module) {
        this.strategyModule = module;
    }

    commandBid(data) {
        if (data.turn == this.index) {
            this.bidAsync();
        }
    }

    async bidAsync() {
        let bid = await this.strategyModule.makeBid();
        core.incomingBid(this.index, bid);
    }

    commandPlay(data) {
        if (data.turn == this.index) {
            this.playAsync();
        }
    }

    async playAsync() {
        let card = await this.strategyModule.makePlay();
        core.incomingPlay(this.index, card);
    }
}

// Core
var CoreStateEnum = function () {
    this.PREGAME = 0;
    this.BIDDING = 1;
    this.PLAYING = 2;
    this.POSTGAME = 3;
};

class Core {
    constructor(players) {
        this.state = CoreState.PREGAME;
        this.options = new Options();
        this.players = players;
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
        this.addRobots();
        this.randomizePlayerOrder();

        this.buildRounds();
        this.updateRounds();

        this.roundNumber = 0;
        this.playNumber = 0;

        this.players.newGame();

        this.trumps = [];
        this.deck = new Deck(this.options.D);
        this.deal();
    }

    randomizePlayerOrder() {}

    addRobots() {
        let robots = [];
        let modules = ai.buildStrategyModules(
            this.options.robots,
            this.players.size() + this.options.robots,
            this.options.D
        );
        for (let i = 0; i < this.options.robots; i++) {
            let player = new AiPlayer(i + 1, this);
            player.setStrategyModule(modules[i]);
            modules[i].setCoreAndPlayer(this, player);
            robots.push(player);
        }
        this.players.addRobots(robots);
    }

    buildRounds() {
        this.rounds = [];

        //this.rounds.push({dealer: 0, handSize: 1, isOver: false});

        let maxH = Math.min(10, Math.floor(51 * this.options.D / players.size()));
        for (let i = maxH; i >= 2; i--) {
            this.rounds.push({dealer: 0, handSize: i, isOver: false});
        }
        for (let i = 0; i < players.size(); i++) {
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

        this.players.newRound();
        this.sendDealerLeader();
        this.players.giveHands(hands);

        this.state = CoreState.BIDDING;

        this.players.communicateTurn(this.state, this.turn);
    }

    incomingBid(index, bid) {
        let player = players.get(index);

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
            this.trickOrder = new TrickOrder(this.trump.suit, this.players.size());
        }

        this.players.communicateTurn(this.state, this.turn);
    }

    incomingPlay(index, card) {
        let player = players.get(index);

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
        console.log(this.trickOrder.order);

        this.players.playReport(index, card);

        this.turn = this.players.nextUnkicked(this.turn);

        if (!this.players.allHavePlayed()) {
            this.players.communicateTurn(this.state, this.turn);
        } else {
            this.turn = this.trickOrder.getWinner();
            this.leader = this.turn;
            this.players.trickWinner(this.turn);
            this.trickOrder = new TrickOrder(this.trump.suit);
            this.playNumber++;

            if (!this.players.hasEmptyHand(this.turn)) {
                this.players.communicateTurn(this.state, this.turn);
            } else {
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

        }
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
        let h = this.getHandSize();

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
            return trick.cancelsRequired(index);
        }

        let ans = new Array(trick.N);
        if (trick.order.length == 0) {
            ans[trick.leader] == 0;
        }

        let handSet = new Set();
        if (index !== undefined) {
            this.players.players[index].getHand().forEach(c => handSet.add(c.toNumber()));
        }

        let i = 0;
        let max = (trick.leader - this.turn + trick.N - 1) % trick.N;
        for (const entry of trick.order) {
            ans[entry.index] = i;

            if (D == 1) {
                break;
            }

            let uncancelableBecauseSeen = this.seen.matchingCardsLeft(entry.card) == this.options.D - 1;
            let uncancelableBecauseInHand = handSet.has(card.toNumber());
            if (uncancelableBecauseSeen || uncancelableBecauseInHand || i == max) {
                break;
            }

            i++;
        }

        for (i = 0; i < trick.N; i++) {
            
        }
    }
}

class TrickOrderEntry {
    constructor(card, index) {
        this.card = card;
        this.index = index;
    }
}

class TrickOrder {
    constructor(trump, N) {
        this.order = [];
        this.trump = trump;
        this.led = -1;
        this.N = N;
    }

    copy() {
        let ans = TrickOrder(this.trump, this.N);
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

// vars
var players = new PlayersList();
var host = undefined;
var CoreState = new CoreStateEnum();
var core = new Core(players);

// Coordinator
function joinPlayer(player, id) {
    player.setName(id);
    player.setId(id);

    if (host == undefined) {
        host = player;
    }
    player.setHost(host === player);

    player.commandJoin();
    players.addPlayer(player);
}

function disconnectPlayer(player, kick) {
    players.disconnectPlayer(player, kick);
}




/*var nn = new ml.NNModel('./models/N5/D1/T0/ivl.txt', ['ReLu', 'Sigmoid']);

var arr = new Array(87);
for (let i = 0; i < 87; i++) {
    arr[i] = Math.random();
}

var str = '';
for (const x of arr) {
    str += ',' + x;
}
str = '{' + str.substring(1) + '}';
console.log(str);

var v = new ml.BasicVector(arr);
var w = nn.evaluate(v);
console.log(w.toArray());
*/
