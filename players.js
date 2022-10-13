var fs = require('fs');
var robotNames = fs.readFileSync('./misc/firstnames.txt', 'utf8').split('\r\n');

class Player {
    constructor() {
        this.user = undefined
        this.kibitzer = false;
        this.replacedByRobot = false;
        this.team = 0;
        this.decisions = []
    }

    personalize(index) {
        return {strategyModule: undefined}
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

    addBid(bid, offset) {
        this.bid = bid;
        this.bidded = true;
        this.bids.push(bid);

        let qs = this.bidQs[this.bidQs.length - 1];
        let aiBid = this.aiBids[this.aiBids.length - 1];
        if (!offset) {
            offset = 0;
        }
        this.hypoPointsLost.push(ai.pointsMean(qs, aiBid + offset) - ai.pointsMean(qs, this.bid + offset));
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

    startDecision(decision) {
        if (!this.kibitzer) {
            // this.decision = data;
            this.decisionAsync(data);
            // this.commandDecision(data);
        }
    }

    async decisionAsync(decision) {
        let choice = await this.strategyModule.makeDecision(decision);
        this.decisionReady(choice, decision.command);
    }

    decisionReady(choice, command) {}

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
    commandDecision(data) {}
    removeDecision() {}
    commandDeal(data) {}
    updateHands(data) {}
    commandPassReport(data) {}
    commandTrickWinner(data) {}
}

class PlayersList {
    constructor(data) {
        if (data) {
            this.players = data.players.map(p => new Player(p))
            this.kibitzers = data.kibitzers.map(p => new Player(p))
            this.teams = data.teams.map(t => new Team(t))
            return
        }

        this.players = []
        this.kibitzers = []
        this.teams = []
        for (let i = 0; i < 10; i++) {
            this.teams.push(new Team(i))
        }
    }

    toDict(index) {
        if (arguments.length == 0) {
            index = -1;
        }
        return {
            info: this.players.map(p => p.toDict()),
            hands: this.players.map(p => p.hand.map(c => (index == -1 || p.index == index ? c : new Card()).toDict())),
            decision: this.players.map(p => p.index == index ? p.decision : undefined),
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

    emitState(pDatas, data) {
        for (const [player, pData] of pDatas) {
            if (player.human && player.socket.connected) {
                player.socket.emit('state', pData)
            }
        }
    }

    emitStateDiff(pDatas, data) {
        // TODO
    }

    emitAll(type, data) {
        for (const list of [this.players, this.kibitzers]) {
            for (const player of list) {
                if (player.human && player.socket.connected) {
                    player.socket.emit(type, data);
                }
            }
        }
    }

    // addPlayer(player, isGameNotStarted) {
    //     // check if it's a reconnect
    //     let reconnect = false;
    //     for (const p of this.players) {
    //         if (p.id == player.id) {
    //             p.user = user;
    //             user.player = p;
    //             p.setDisconnected(false);
    //             player = p;
    //
    //             // let playerData = {players: [player.toDict()]};
    //             // for (const list of [this.players, this.kibitzers]) {
    //             //     for (const p1 of list) {
    //             //         if (p1 !== player) {
    //             //             p1.commandUpdatePlayers(playerData);
    //             //         }
    //             //     }
    //             // }
    //
    //             reconnect = true;
    //             break;
    //         }
    //     }
    //
    //     if (isGameNotStarted) {
    //         if (!reconnect) {
    //             player.index = this.players.length;
    //             this.players.push(player);
    //
    //             let playerData = {players: [player.toDict()]};
    //             let allData = {players: this.players.map(p => p.toDict())};
    //             for (const list of [this.players, this.kibitzers]) {
    //                 for (const p of list) {
    //                     if (p !== player) {
    //                         p.commandAddPlayers(playerData);
    //                     }
    //                 }
    //             }
    //             // player.commandAddPlayers(allData);
    //             // this.updateTeams();
    //         }
    //     } else {
    //         if (!reconnect) {
    //             this.kibitzers.push(player);
    //             player.kibitzer = true;
    //         }
    //         let allData = {
    //             players: this.players.map(p => p.toDict())
    //         };
    //         player.commandAddPlayers(allData);
    //         player.commandUpdateTeams({teams: this.teams.map(t => t.toDict())});
    //         player.commandStart();
    //         player.commandGameState(this.core.toDict(player.kibitzer ? -1 : player.index));
    //     }
    // }

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

        let prePost = this.core.isGameNotStarted();

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
                player.startBid({turn: turn, ss: data.ss});
            }
            for (const player of this.kibitzers) {
                player.startBid({turn: turn, ss: data.ss});
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

    bidReport(index, bid, offset) {
        this.players[index].addBid(bid, offset);
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

            if (this.game.mode == 'Hearts') { //TODO
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
        for (const player of this.players) {
            if (player.index == index) {
                continue;
            }

            player.startDecision({
                name: 'claim',
                prompt: `${this.players[index].name} claims the rest of the tricks.`,
                choices: ['Accept', 'Reject'],
                data: {
                    index: index,
                    hand: this.players[index].hand.map(c => c.toDict())
                }
            });
        }
    }

    respondToClaim(index, accept) {
        if (!accept) {
            this.emitAll('claimresult', {accepted: false, claimer: this.core.claimer});
            this.core.claimer = undefined;

            for (const player of this.players) {
                player.acceptedClaim = false;
                player.removeDecision();
            }

            return;
        }

        this.players[index].acceptedClaim = true;
        this.players[index].removeDecision();
        if (this.players.filter(p => p.human && !p.replacedByRobot && !p.acceptedClaim).length == 0) {
            let winner = this.players[this.core.claimer];
            let remaining = winner.hand.length;
            if (!winner.trick.isEmpty()) {
                remaining++;
            }

            winner.taken += remaining;

            this.emitAll('claimresult', {accepted: true, claimer: this.core.claimer, remaining: remaining});
            this.core.acceptClaim();
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
    constructor(user) {
        super()
        this.user = user
        this.id = user.id
        this.disconnected = false
        this.human = true
        this.synced = false
    }

    commandJoin(data) {
        this.socket.emit('join', data);
    }

    commandGameState(data) {
        this.user.socket.emit('gamestate', data);
    }

    commandAddPlayers(data) {
        this.socket.emit('addplayers', data);
    }

    commandRemovePlayers(data) {
        this.user.socket.emit('removeplayers', data);
    }

    commandUpdatePlayers(data) {
        this.user.socket.emit('updateplayers', data);
    }

    commandUpdateTeams(data) {
        this.socket.emit('updateteams', data);
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

    commandDecision(data) {
        this.user.socket.emit('decision', data);
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
        } else if (this.readiedPass !== undefined) {
            this.core.incomingPass(this.index, this.readiedPass);
            this.readiedPass = undefined;
        } else if (this.readiedDecision !== undefined) {
            this.core.makeDecision(this.index, this.readiedDecision);
            this.readiedDecision = undefined;
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

    decisionReady(choice) {
        if (this.replacedByRobot) {
            this.core.makeDecision(this.index, choice);
            this.readiedDecision = undefined;
        } else {
            this.readiedDecision = choice;
        }
    }

    poke() {
        this.user.socket.emit('poke');
    }

    removeDecision() {
        this.decision = undefined;
        this.user.socket.emit('removedecision');
    }
}

class AiPlayer extends Player {
    constructor(i, game) {
        super();
        this.disconnected = false;
        this.human = false;
        this.id = '@robot' + i;
        this.name = robotNames[Math.floor(robotNames.length * Math.random())] + ' bot'
        this.game = game;
    }

    personalize(index) {
        return Object.assign(super.personalize(index), {game: undefined})
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

    decisionReady(choice, command) {
        choice.index = this.index
        this.game.command(Object.assign({name: command}, choice))
        // this.core.makeDecision(this.index, choice);
    }

    removeDecision() {
        this.decision = undefined;
    }
}

class Team {
    constructor(number) {
        this.number = number
        this.resetName()
        this.members = []
    }

    personalize(index) {
        return {members: this.members.map(p => p.index)}
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

    buildMembers(players) {
        this.members = players.filter(p => p.team == this.number)
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

module.exports = {
    PlayersList: PlayersList,
    Player: Player,
    HumanPlayer: HumanPlayer,
    AiPlayer: AiPlayer,
    Team: Team
}
