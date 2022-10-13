var fs = require('fs')
var ml = require('./ml')
var ai = require('./ai')
var players = require('./players')
PlayersList = players.PlayersList
Player = players.Player
HumanPlayer = players.HumanPlayer
AiPlayer = players.AiPlayer
Team = players.Team

var gameExpirationTime = 1000 * 10; // millisec

function personalize(obj, index) {
    if (obj === undefined || obj === null) {
        return obj
    }
    if (Array.isArray(obj)) {
        return obj.map(x => personalize(x, index))
    }
    if (typeof obj === 'function') {
        return undefined
    }
    if (typeof obj === 'object') {
        let ans = {}
        if ('personalize' in obj) {
            Object.assign(ans, obj.personalize(index))
        }
        for (const [k, v] of Object.entries(obj)) {
            if (!(k in ans)) {
                ans[k] = personalize(v, index)
            }
        }
        return ans
    }
    return obj
}

function update(obj, data) {
    if (data.type == 'pass') {
        return
    }

    let x = obj
    for (const key of data.path) {
        x = x[key]
    }

    if (data.type == 'set') {
        x[data.key] = data.value
    } else if (data.type == 'insert') {
        x.splice(data.index, 0, data.value)
    } else if (data.type == 'remove') {
        x.splice(data.index, 1)
    }
}

class Game {
    constructor(data, mp, pub) {
        this.id = new Date().getTime()
        this.mode = data
        this.mp = mp
        this.public = pub
        this.listed = false

        this.players = []
        this.kibitzers = []
        this.teams = []
        for (let i = 0; i < 10; i++) {
            this.teams.push(new Team(i))
        }
        this.host = undefined

        this.state = 'PREGAME'
        this.initializeOptions()
        this.updates = []
    }

    personalize(index) {
        return {updates: undefined}
    }

    // Emitting
    update(data, flush) {
        update(this, data)
        this.updates.push(data)
        if (flush) {
            this.flush()
        }
    }

    flush() {
        for (const list of [this.players, this.kibitzers]) {
            for (const player of list) {
                if (!player.human) {
                    continue
                }

                let index = player.kibitzer ? -1 : player.index
                if (!player.synced) {
                    player.synced = true
                    player.user.socket.emit('state', personalize(this, index))
                } else {
                    player.user.socket.emit('update', this.updates.map(u => personalize(u, index)))
                }
            }
        }
        this.updates = []
    }

    // Game
    joinUser(data) {
        let player = new HumanPlayer(data.user);
        player.name = data.user.id;

        if (!this.host) {
            this.host = player;
        }
        player.host = this.host === player;

        data.user.player = player;
        data.user.game = this;

        this.listed = true;

        data.user.socket.emit('join', {id: this.id, mode: this.mode})

        // check if it's a reconnect
        let reconnect = false;
        for (const p of this.players) {
            if (p.id == player.id) {
                p.user = user;
                user.player = p;
                p.setDisconnected(false);
                player = p;

                reconnect = true;

                this.update({type: 'set', path: ['players'], index: player.index, value: player})

                break;
            }
        }

        if (!reconnect) {
            if (this.isGameNotStarted()) {
                this.insertPlayer(player)
            } else {
                player.kibitzer = true;
                this.update({type: 'insert', path: ['kibitzers'], index: player.index, value: player})
            }
        }

        this.flush()

        this.stopExpirationTimer()
    }

    disconnectUser(data) {
        let player = data.user.player

        player.setDisconnected(true)

        if (this.host === player) {
            player.host = false;
            this.host = undefined;
            for (const p of this.players) {
                if (!p.disconnected && p.human) {
                    this.update({type: 'set', path: [], key: 'host', value: p})
                    this.update({type: 'set', path: ['players', p.index], key: 'host', value: true})
                }
            }
        }

        let prePost = this.isGameNotStarted();

        if (player.kibitzer) {
            let kIndex = 0
            for (const k of this.kibitzers) {
                if (k === player) {
                    break
                }
                kIndex++
            }

            this.update({type: 'remove', path: ['kibitzers'], index: kIndex})
        } else if (prePost) {
            this.removePlayer(player.index)
        } else {
            this.update({type: 'set', path: ['players'], index: player.index, value: player})
        }

        this.flush()

        if (this.players.filter(p => p.human && !p.disconnected).length == 0 && this.kibitzers.length == 0) {
            this.startExpirationTimer();

            // we don't want to dispose of the game right away
            if (prePost) {
                this.listed = false;
            }
        }

        data.user.kick();
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

    dispose(gameDict) {
        if (fs.existsSync(this.jsonFilePath())) {
            fs.unlink(this.jsonFilePath(), err => {
                if (err) {
                    log(`ERROR: unable to remove ${this.jsonFilePath()}.`);
                }
            });
        }
        delete gameDict[this.id];
    }

    publishJson(json) {
        fs.writeFileSync(this.jsonFilePath(), JSON.stringify(json));
    }

    command(data) {
        if (!data.name) {
            return 'command: Name missing.'
        }

        if (!this[data.name]) {
            return `command: Invalid name ${data.name}.`
        }

        let ret = this[data.name](data)

        if (ret && ret.error) {
            return `${data.name}: ${ret.error}`
        }
    }

    gameListEntry() {
        return {
            id: this.id,
            mp: this.mp,
            public: this.public,
            listed: this.listed,
            mode: this.mode,
            host: this.host ? this.host.id : '',
            players: this.players.filter(p => p.human).length,
            state: this.isGameNotStarted ? 'In lobby' : 'In game'
        };
    }

    // Options
    initializeOptions() {
        this.options = {}
    }

    validateOptions(options) {
        return true
    }

    updateOptions(data) {
        if (!data.options) {
            return {error: `Options missing.`}
        }

        if (!this.validateOptions(data.options)) {
            return {error: `Invalid options.`}
        }

        if (this.host && !data.user.player.host) {
            return {error: `Player is not host.`}
        }

        Object.assign(this.options, data.options)
        for (const [k, v] of Object.entries(data.options)) {
            this.update({type: 'set', path: ['options'], key: k, value: v})
        }

        // update robot count
        let robots = this.players.filter(p => !p.human)
        let count = this.options.robots
        for (let i = robots.length; i < count; i++) {
            let player = new AiPlayer(i + 1, this);
            this.insertPlayer(player)
        }
        for (let i = robots.length; i > count; i--) {
            this.removePlayer(robots[i - 1].index)
        }

        this.flush()
    }

    // Players and teams
    insertPlayer(player) {
        player.index = this.players.length;
        this.update({type: 'insert', path: ['players'], index: player.index, value: player})
        this.updateTeamMembers(player.team)
    }

    removePlayer(index) {
        this.update({type: 'remove', path: ['players'], index: index})
        let affectedTeams = new Set()
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].index != i) {
                this.update({type: 'set', path: ['players', i], key: 'index', value: i})
                affectedTeams.add(this.players[i].team)
            }
        }
        for (const number of affectedTeams) {
            this.updateTeamMembers(number)
        }
    }

    reteam(data) {
        if (data.user) {
            let requesterPlayer = data.user.player
            if (requesterPlayer.index != data.index && !requesterPlayer.host) {
                return {error: `Player ${requesterPlayer.id} attempted to reteam someone else, but they are not host.`}
            }
        }

        let number = data.number
        if (number === undefined) {
            for (number = 0; number < 10 && this.teams[number].members.length != 0; number++)
            if (number == 10) {
                return;
            }
        }

        let oldNumber = this.players[data.index].team
        this.update({type: 'set', path: ['players', data.index], key: 'team', value: number})

        this.updateTeamMembers(oldNumber)
        this.updateTeamMembers(number)

        this.flush()
    }

    scrambleTeams(data) {
        // if (debug) {
        //     this.players.reteam(1, 1);
        //     this.players.reteam(2, 0);
        //     this.players.reteam(3, 2);
        //     this.players.reteam(4, 1);
        //     this.players.reteam(5, 2);
        //     this.players.reteam(0, 0);
        //     return;
        // }

        let requesterPlayer = data.user.player
        if (!requesterPlayer.host) {
            return {error: `Player ${requesterPlayer.id} attempted to scramble teams, but they are not host.`}
        }

        let N = this.players.length
        let properDivisors = []
        for (let i = 2; i < N; i++) {
            if (N % i == 0) {
                properDivisors.push(i);
            }
        }
        if (properDivisors.length > 0) {
            let numTeams = properDivisors[Math.floor(Math.random() * properDivisors.length)];
            let playersPerTeam = N / numTeams;
            let playersToChoose = this.players.map(p => p);
            for (let i = 0; i < numTeams; i++) {
                for (let j = 0; j < playersPerTeam; j++) {
                    let player = playersToChoose.splice(Math.floor(Math.random() * playersToChoose.length), 1)[0]
                    this.update({type: 'set', path: ['players', player.index], key: 'team', value: i})
                }
            }
            for (let i = 0; i < this.teams.length; i++) {
                if (i < numTeams || this.teams[i].members.length > 0) {
                    this.updateTeamMembers(i)
                }
            }
        }

        this.flush()
    }

    updateTeamMembers(number) {
        let team = this.teams[number]
        team.buildMembers(this.players)
        this.update({type: 'set', path: ['teams'], key: number, value: team})
    }

    nextUnkicked(index) {
        return (index + 1) % this.players.length
    }

    playersNewGameReset() {
        for (const player of this.players) {
            player.newGameReset()
            this.update({type: 'set', path: ['players'], key: player.index, value: player})
        }
    }

    playersNewRoundReset() {
        for (const player of this.players) {
            player.newRoundReset()
            this.update({type: 'set', path: ['players'], key: player.index, value: player})
        }
    }

    // Game logic
    isGameNotStarted() {
        return this.state == 'PREGAME' || this.state == 'POSTGAME'
    }

    verifyGameCanStart() {
        return true
    }

    startGame() {
        if (!this.verifyGameCanStart()) {
            return
        }

        this.attachStrategyModules()

        if (this.serverSide && this.options.randomizePlayerSeating) {
            this.randomizePlayerSeating()
        }

        this.buildRounds();
        this.update({type: 'set', path: [], key: 'roundNumber', value: 0})
        this.update({type: 'set', path: [], key: 'playNumber', value: 0})
        // this.updateRounds();

        this.playersNewGameReset()

        this.trumps = [];
        this.leaders = [];
        this.winners = [];
        this.claims = [];
        this.deck = new Deck(this.options.D);

        // if (debug) {
        //     var sample = require('./sample');
        //     this.fullDeals = sample.sample.map(ds => ds.map(h => h.map(c => new Card().fromString(c))));
        // }

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

    randomizePlayerSeating() {
        //TODO
    }

    attachStrategyModules() {
        let T = this.teams.filter(t => t.members.length > 0).length
        let modules = ai.buildStrategyModules(
            this.mode,
            {
                N: this.players.length,
                D: this.options.D,
                T: this.options.teams ? T : 0
            }
        )
        for (let i = 0; i < modules.length; i++) {
            this.players[i].strategyModule = modules[i]
            modules[i].setCoreAndPlayer(this, this.players[i])
        }
    }

    // updateRounds() {
    //     let dIndex = this.players.nextUnkicked(-1);
    //     for (const round of this.rounds) {
    //         round.dealer = dIndex;
    //         dIndex = this.players.nextUnkicked(dIndex);
    //     }
    //
    //     this.players.updateRounds(this.rounds, this.roundNumber);
    // }

    getDealer() {
        return this.rounds[this.roundNumber].dealer;
    }

    getHandSize() {
        return this.rounds[this.roundNumber].handSize;
    }

    // sendDealerLeader() {
    //     this.players.sendDealerLeader(this.getDealer(), this.leader);
    // }

    deal() {
        this.deck.initialize();
        this.seen = new SeenCollection([], this.options.D);

        let hands = this.getNextHands();

        this.update({type: 'set', path: [], key: 'trump', value: hands.trump[0]})
        this.trumps.push(this.trump);
        this.seen.add(this.trump);

        this.update({type: 'set', path: [], key: 'turn', value: this.nextUnkicked(this.getDealer())})
        this.update({type: 'set', path: [], key: 'leader', value: this.turn})

        this.leaders.push([]);
        this.winners.push([]);

        this.playersNewRoundReset()
        // this.sendDealerLeader();
        // this.players.giveHands(hands);
        for (let i = 0; i < hands.hands.length; i++) {
            let hand = hands.hands[i]
            this.update({type: 'set', path: ['players', i], key: 'hand', value: hand})
            this.players[i].hands.push(hand.map(c => c))
        }

        this.update({type: 'set', path: [], key: 'playNumber', value: 0})

        this.transitionFromDeal();
    }

    finishRound() {
        this.scoreRound();
        this.update({type: 'set', path: ['rounds', this.roundNumber], key: 'isOver', value: true})
        this.update({type: 'set', path: [], key: 'roundNumber', value: this.roundNumber + 1})

        this.transitionFromRoundEnd();
    }

    scoreRound() {}

    sendPostGame() {
        this.update({type: 'set', path: [], key: 'state', value: 'POSTGAME'})

        // win %
        let winningScore = Math.max(...this.players.map(p => p.score))
        let wb = new ml.BagModel(`./models/N${this.players.length}/D${this.options.D}/T0/wb.txt`);
        for (let j = 0; j < this.rounds.length; j++) {
            if (j >= this.players[0].scores.length) {
                break;
            }

            let v = new ml.BasicVector(this.players.map(p => p.scores[j]).concat([this.rounds.length - 1 - j]));
            let wbProbs = j == this.rounds.length - 1 ?
                this.players.map(p => p.score == winningScore ? 1 : 0) :
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
        this.players[index].poke();
    }

    incomingClaim(index) {
        if (this.state != CoreState.PLAYING || this.claimer !== undefined) {
            return;
        }

        this.claimer = index;
        this.players.announceClaim(index);

        this.makeDecision(index, {name: 'claim', choice: 0}); // claimer auto-accepts
    }

    acceptClaim() {
        this.claims.push(this.claimer);
        this.claimer = undefined;
        this.claimAccepted();
    }

    claimAccepted() {
        this.finishRound();
    }

    makeDecision(index, data) {}

    // standard
    whatCanIPlay(index) {
        let led = this.trickOrder.getLed();
        let hand = this.players[index].hand;
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
        return this.players[this.leader].trick;
    }
}

class Decision {
    constructor(name, index, command, data) {
        this.name = name
        this.index = index
        this.command = command
        this.data = data
    }

    personalize(index) {
        if (index != this.index) {
            return {data: undefined}
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

module.exports = {
    Game: Game,
    SeenCollection: SeenCollection,
    personalize: personalize,
    update: update,
    Decision: Decision
}
