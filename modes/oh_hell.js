var core = require('./../core')
var ai = require('./../ai');
Game = core.Game
Decision = core.Decision
SeenCollection = core.SeenCollection

class OhHellCore extends Game {
    constructor(data, mp, pub) {
        super(data, mp, pub)
    }

    verifyGameCanStart() {
        let N = this.players.filter(p => p.human).length + Number(this.options.robots)
        return N >= 2 && N <= 10
    }

    transitionFromStart() {
        try {
            let T = this.options.teams ? this.teams.filter(t => t.members.length > 0).length : 0;
            let path = `./models/N${this.players.length}/D${this.options.D}/T${T}/ss.txt`;
            if (fs.existsSync(path)) {
                this.spreadsheet = fs.readFileSync(path, 'utf8');
                this.spreadsheet = this.spreadsheet.split('\r\n').map(row => row.split(','));
            }
        } catch(err) {
            this.spreadsheet = undefined;
        }
        this.deal();
    }

    getNextHands() {
        let deal = undefined;

        // if (debug) {
        //     deal = this.fullDeals[this.roundNumber];
        // } else {
        //     deal = this.deck.deal(this.players.length, this.rounds[this.roundNumber].handSize, true);
        // }

        deal = this.deck.deal(this.players.length, this.rounds[this.roundNumber].handSize, true);

        return {
            hands: deal.slice(0, this.players.length),
            trump: deal[this.players.length]
        };
    }

    buildRounds() {
        let rounds = []

        // rounds.push({dealer: 0, handSize: 1, isOver: false});
        // rounds.push({dealer: 0, handSize: 1, isOver: false});

        let dealer = 0
        let maxH = Math.min(10, Math.floor(51 * this.options.D / this.players.length));
        for (let i = maxH; i >= 2; i--) {
            rounds.push({dealer: dealer, handSize: i, isOver: false});
            dealer = this.nextUnkicked(dealer)
        }
        for (let i = 0; i < this.players.length; i++) {
            rounds.push({dealer: dealer, handSize: 1, isOver: false});
            dealer = this.nextUnkicked(dealer)
        }
        for (let i = 2; i <= maxH; i++) {
            rounds.push({dealer: dealer, handSize: i, isOver: false});
            dealer = this.nextUnkicked(dealer)
        }

        this.update({type: 'set', path: [], key: 'rounds', value: rounds})
    }

    transitionFromDeal() {
        this.update({type: 'set', path: [], key: 'state', value: 'BIDDING'}, true)
        this.communicateTurn();
    }

    communicateTurn() {
        let data = {}
        data.ss = this.spreadsheet ? this.spreadsheet[0] : undefined

        let name = ''
        let command = ''

        if (this.state == 'BIDDING') {
            name = 'bid'
            command = 'incomingBid'
        } else if (this.state == 'PLAYING') {
            name = 'play'
            command = 'incomingPlay'
            data.canPlay = this.whatCanIPlay(this.turn)
        } else if (this.state == 'PASSING') {
            for (const player of this.players) {
                player.startPass({turn: this.turn});
            }
            for (const player of this.kibitzers) {
                player.startPass({turn: this.turn});
            }
        }

        let decision = new Decision(name, this.turn, command, data)
        this.update({type: 'set', path: ['players', this.turn], key: 'decisions', value: [decision], keyword: name})
        this.players[this.turn].decisionAsync(decision)

        this.flush()
    }

    incomingBid(data) {
        let index = data.index
        if ('user' in data) {
            index = data.user.player.index
        }

        let player = this.players[index];
        let bid = data.bid

        if (player.decisions[player.decisions.length - 1].name != 'bid') {
            log('ERROR: Player "' + player.id + '" attempted to bid but was given no bid decision.');
            return;
        } else if (index != this.turn) {
            log('ERROR: Player "' + player.id + '" attempted to bid out of turn.');
            return;
        } else if (this.state != 'BIDDING') {
            log('ERROR: Player "' + player.id + '" attempted to bid, but the game is not in bidding state.');
            return;
        } else if (bid < 0 || bid > this.getHandSize()) {
            log('ERROR: Player "' + player.id + '" attempted to bid ' + bid + ' with a hand size of ' + this.getHandSize() + '.');
            return;
        } else if (bid == this.whatCanINotBid(index)) {
            log('ERROR: Player "' + player.id + '" attempted to bid what they cannot bid as dealer.');
            return;
        }

        this.update({type: 'set', path: ['players', player.index], key: 'decisions', value: []})

        let offset = 0;
        if (this.options.teams) {
            offset = this.teams[player.team].bid();
        }

        this.recordPlayerBid(index, bid, offset);

        this.update({type: 'set', path: [], key: 'turn', value: this.nextUnkicked(this.turn)})

        let bidI = 0;
        for (let i = 0; i < this.players.length && this.rounds[this.roundNumber].handSize == 1; i++) {
            let j = (this.rounds[this.roundNumber].dealer + 1 + i) % this.players.length;
            bidI += (this.players[j].bid << i);
        }

        let ddata = {canPlay: undefined, ss: this.spreadsheet && this.rounds[this.roundNumber].handSize == 1 ? this.spreadsheet[bidI] : undefined};
        if (!this.players.some(p => !p.bidded)) {
            this.update({type: 'set', path: [], key: 'state', value: 'PLAYING', keyword: 'allBid'})
            this.trickOrder = new TrickOrder(this.trump.suit);
            ddata.canPlay = this.whatCanIPlay(this.turn);
        }

        this.communicateTurn();
    }

    recordPlayerBid(index, bid, offset) {
        let player = this.players[index]

        this.update({type: 'set', path: ['players', index], key: 'bid', value: bid, robotDelay: !player.human})
        this.update({type: 'set', path: ['players', index], key: 'bidded', value: true, keyword: 'bidded'})
        this.update({type: 'insert', path: ['players', index, 'bids'], index: player.bids.length, value: bid})

        let qs = player.bidQs[player.bidQs.length - 1];
        let aiBid = player.aiBids[player.aiBids.length - 1];
        if (!offset) {
            offset = 0;
        }
        player.hypoPointsLost.push(ai.pointsMean(qs, aiBid + offset) - ai.pointsMean(qs, bid + offset));
    }

    incomingPlay(data) {
        let index = data.index
        if ('user' in data) {
            index = data.user.player.index
        }

        let player = this.players[index];
        let card = new Card(data.play.num, data.play.suit, -2)

        if (player.decisions[player.decisions.length - 1].name != 'play') {
            log('ERROR: Player "' + player.id + '" attempted to play but was given no play decision.');
            return;
        } else if (index != this.turn) {
            log('ERROR: Player "' + player.id + '" attempted to play out of turn.');
            return;
        } else if (this.state != 'PLAYING') {
            log('ERROR: Player "' + player.id + '" attempted to play, but the game is not in playing state.');
            return;
        } else if (!player.hand.some(c => c.matches(card))) {
            log('ERROR: Player "' + player.id + '" attempted to play ' + card.toString() + ', but they do not have that card.');
            return;
        } else if (!this.whatCanIPlay(index).filter(c => c.matches(card)).length) {
            log('ERROR: Player "' + player.id + '" attempted to play ' + card.toString() + ', failing to follow suit.');
            return;
        }

        this.update({type: 'set', path: ['players', player.index], key: 'decisions', value: []})

        this.seen.add(card);

        this.trickOrder.push(card, index);

        this.recordPlayerPlay(index, card, index == this.leader, this.getLead().suit)

        this.update({type: 'set', path: [], key: 'turn', value: this.nextUnkicked(this.turn)})

        if (this.players.some(p => p.trick.isEmpty())) {
            this.communicateTurn()
        } else {
            this.update({type: 'set', path: [], key: 'turn', value: this.trickOrder.getWinner(), keyword: 'trickWinner'})
            this.winners[this.winners.length - 1].push(this.turn);
            this.leaders[this.leaders.length - 1].push(this.leader);
            this.update({type: 'set', path: [], key: 'leader', value: this.turn = this.turn})

            // this.players[index].cardsTaken.push(...this.players.map(p => p.trick)); // TODO for hearts

            for (const p of this.players) {
                p.newTrickReset()
                this.update({type: 'set', path: ['players'], key: p.index, value: p})
            }

            this.update({type: 'set', path: ['players', this.turn], key: 'taken', value: this.players[this.turn].taken + 1})

            this.trickOrder = new TrickOrder(this.trump.suit);
            this.update({type: 'set', path: [], key: 'playNumber', value: this.playNumber + 1, keyword: 'newTrickReset'}, true)

            if (this.players[this.turn].hand.length > 0) {
                this.communicateTurn();
            } else {
                this.claims.push(-1);
                this.finishRound();
            }
        }
    }

    recordPlayerPlay(index, card, isLead, follow) {
        let player = this.players[index]

        for (let i = 0; i < player.hand.length; i++) {
            if (player.hand[i].matches(card)) {
                this.update({type: 'remove', path: ['players', index, 'hand'], index: i, robotDelay: !player.human})
                break
            }
        }
        this.update({type: 'set', path: ['players', index], key: 'played', value: true})
        this.update({type: 'set', path: ['players', index], key: 'trick', value: card, keyword: 'playReport'})

        player.plays[player.plays.length - 1].push(card);

        let roundProbs = player.makingProbs[player.makingProbs.length - 1];
        let probs = roundProbs[roundProbs.length - 1];
        let maxProb = Math.max(...probs.map(pair => pair[1]));
        let myProb = probs.filter(pair => pair[0].matches(card))[0][1];
        player.roundMistakes += maxProb < 0.0001 ? 0 : Math.min(maxProb / myProb - 1, 1);

        player.hadSuit[card.suit] = true;
        if (!isLead && card.suit != follow) {
            player.shownOut[follow] = true;
        }
    }

    scoreRound() {
        let newScores = [];
        for (const player of this.players) {
            player.takens.push(player.taken);

            let bid = this.options.teams ? this.teams[player.team].bid() : player.bid;
            let taken = this.options.teams ? this.teams[player.team].taken() : player.taken;
            let score = this.scoreFunc(bid, taken);

            this.update({type: 'set', path: ['players', player.index], key: 'score', value: player.score + score})
            player.scores.push(player.score);
            // newScores.push(player.score);

            player.mistakes.push(player.roundMistakes);

            let qs = player.bidQs[player.bidQs.length - 1];
            let mu = ai.pointsMean(qs, player.bid);
            let sig2 = ai.pointsVariance(qs, player.bid);

            let luck = Math.min(5, Math.max(-5,
                (score - mu) / Math.sqrt(sig2)
            ));
            player.addLuck(sig2 == 0 ? 0 : luck);
        }
        this.update({type: 'set', path: [], key: 'test', value: 0, keyword: 'roundEnd'})
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

        let allHands = new Array(this.players.length);
        for (const player of this.players) {
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
                for (let i = 0; i < this.players.length; i++) {
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

    makeDecision(index, data) {
        if (data.name == 'claim') {
            if (this.claimer === undefined) {
                return;
            }

            this.players.respondToClaim(index, data.choice == 0);
        }
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
            let ans = this.getHandSize();
            for (const player of this.players) {
                if (player.bidded) {
                    ans -= player.bid;
                }
            }
            return ans;
        }
    }

    highestMakeableBid(index, considerDealer) {
        let handSize = this.rounds[this.roundNumber].handSize;
        if (this.options.teams) {
            let team = this.players[index].team;
            let totalBid = 0;
            let ourBid = 0;
            this.players.forEach(p => {
                totalBid += p.bid;
                if (p.team == team) {
                    ourBid += p.bid;
                }
            });

            let dealerOnOurTeam = this.players[this.getDealer()].team == team;

            return Math.max(
                handSize - ourBid - (considerDealer && totalBid == ourBid && dealerOnOurTeam ? 1 : 0),
                0
            );
        } else {
            return handSize;
        }
    }

    getTrickCollection() {
        return new SeenCollection(this.players.map(p => p.trick), this.options.D);
    }

    getHandCollection(index) {
        return new SeenCollection(this.players[index].hand, this.options.D);
    }

    getCardsPlayedCollection(index) {
        let p = this.players[index];
        return new SeenCollection(p.plays[p.plays.length - 1].concat([this.trump]), this.options.D);
    }

    getSeenCollection() {
        return this.seen;
    }

    wants(index) {
        let player = this.players[index];
        let h = this.players[index].hand.length;

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
        let team = this.teams[number];
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

        let N = this.players.length;
        let ans = new Array(N);
        if (trick.order.length == 0) {
            ans[trick.leader] = 0;
        }

        //log(trick.order.map(e => [e.index, e.card.toString()]));

        let handSet = new Set();
        if (index !== undefined) {
            this.players[index].hand.filter(c => c !== card).forEach(c => handSet.add(c.toNumber()));
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



module.exports = {
        OhHellCore: OhHellCore
    }
