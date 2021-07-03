var debug = false;
var logFile = './logs/log.txt';

var ml = require('./ml');
var fs = require('fs');

// shared utils
function difficulty(qs) {
    let A = 0.45;
    let B = 0.025;
    let u = 0;

    let max = Math.max(...qs);
    let r = A - B * (qs.length - 1);
    let s = u == 0 ?
        Math.log(max) / Math.log(r) :
        (Math.pow(max, u) - 1) / (Math.pow(r, u) - 1);

    return Math.max(1, Math.min(10, 1 + 9 * s));
}

function points(k, l) {
    if (k == l) {
        return 10 + k * k;
    } else {
        let d = Math.abs(k - l);
        return -5 * d * (d + 1) / 2;
    }
}

function pointsMean(qs, bid) {
    return qs.reduce((qsum, q, i) => qsum + q * points(i, bid), 0);
}

function pointsVariance(qs, bid) {
    return qs.reduce((qsum, q, i) => qsum + q * Math.pow(points(i, bid), 2), 0) - Math.pow(pointsMean(qs, bid), 2);
}

function log(msg) {
    if (debug) {
        fs.writeFileSync(logFile, msg + '\n', {flag: 'a+'});
    }
}

// dumb ------------------------------------------------------------------------
class StrategyModuleDumb {
    constructor() {}

    setCoreAndPlayer(core, player) {
        this.core = core;
        this.player = player;
    }

    makeBid() {
        let cannotBid = this.core.whatCanINotBid(this.player.getIndex());
        let bid = 0;
        do {
            bid = Math.floor(Math.random() * (this.player.getHand().length + 1));
        } while (bid == cannotBid);
        return bid;
    }

    makePlay() {
        let canPlay = this.core.whatCanIPlay(this.player.getIndex());
        return canPlay[Math.floor(Math.random() * canPlay.length)];
    }
}

// oi --------------------------------------------------------------------------
class StrategyModuleOI {
    constructor(N, D, ovl, ivl) {
        this.N = N;
        this.D = D;
        this.maxH = Math.min(10, Math.floor((52 * D - 1) / N));
        this.maxCancels = D == 1 ? 0 : Math.floor((N - 1) / 2);
        this.ovl = ovl;
        this.ivl = ivl;
    }

    setCoreAndPlayer(core, player) {
        this.core = core;
        this.player = player;
    }

    makeBid() {
        log(`${this.player.name} bid----------------------------------`);

        this.loadSlowFeatures();

        let qs = this.getQs(this.player.getHand().length);
        this.player.addQs(qs);
        this.player.addDiff(difficulty(qs));

        let myBid = this.chooseBid(qs);
        this.player.addAiBid(myBid);

        log(`qs=[${qs}]`);
        log(`bid=${myBid}`);

        return myBid;
    }

    makePlay() {
        log(`${this.player.name} play---------------------------------`);

        let myPlay = undefined;

        let makingProbs = this.getMakingProbs();

        let fullProbs = [];
        let pointer = 0;
        for (const c of this.player.getHand()) {
            if (pointer < makingProbs.length && c.matches(makingProbs[pointer][0])) {
                fullProbs.push(makingProbs[pointer]);
                pointer++;
            } else {
                fullProbs.push([c, -1]);
            }
        }
        this.player.addMakingProbs(fullProbs);

        if (this.player.getHand().length == 1) {
            myPlay = this.player.getHand()[0];
        } else {
            myPlay = this.choosePlay(makingProbs);
        }

        return myPlay;

        //let canPlay = this.core.whatCanIPlay(this.player.getIndex());
        //return canPlay[Math.floor(Math.random() * canPlay.length)];
    }

    getMakingProbs() {
        this.loadSlowFeatures();
        this.canPlay = this.core.whatCanIPlay(this.player.getIndex());

        let ans = [];
        for (const card of this.canPlay) {
            ans.push([card, this.prMakingIfPlayCard(card)]);
        }
        return ans;
    }

    prMakingIfPlayCard(card) {
        log(`consider play ${card.toString()}`);

        let requiredCancels = this.core.cancelsRequired(this.player.getIndex(), card)[this.player.getIndex()];

        let w = this.wants[this.player.getIndex()];

        let prIWin = this.prIWinTrick(card, requiredCancels);
        log(`prIWin=${prIWin}`);
        let qs = this.getQs(w, card);
        log(`qs=${qs}`);

        let prMakingIfIWin = w == 0 ? 0 : qs[w - 1];
        let prMakingIfILose = w == this.player.getHand().length ? 0 : qs[w];

        return prIWin * prMakingIfIWin + (1 - prIWin) * prMakingIfILose;
    }

    prIWinTrick(card, requiredCancels) {
        if (requiredCancels < 0) {
            return 0;
        }

        return this.ivl.evaluate(this.getIvl(card, requiredCancels)).get(0);
    }

    loadSlowFeatures() {
        let myHand = this.player.getHand();

        this.seen = this.core.getHandCollection(this.player.getIndex());
        //this.seen.merge(this.core.getTrickCollection());
        this.seen.merge(this.core.getSeenCollection());

        this.suitCounts = [0, 0, 0, 0];
        for (const card of myHand) {
            this.suitCounts[card.suit]++;
        }
        this.voidCount = 0;
        for (let count of this.suitCounts) {
            if (count == 0) {
                this.voidCount++;
            }
        }

        this.ovlMemo = {};

        this.wants = new Array(this.N);
        for (let i = 0; i < this.N; i++) {
            this.wants[i] = this.core.wants(i);
        }
    }

    getQs(max, card) {
        let ps = this.getPs(card);
        return this.subsetProb(ps, max);
    }

    getPs(card) {
        let h = this.player.getHand().length;
        if (card !== undefined) {
            h--;
        }
        let ps = new Array(h);
        let i = 0;
        for (const c of this.player.getHand()) {
            if (c === card) {
                continue;
            }
            ps[i] = this.getP(c, card);
            i++;
        }

        return ps;
    }

    getP(card, myCard) {
        let voidInc = (myCard !== undefined && this.suitCounts[myCard.suit] == 1) ? 1 : -1;
        let code = voidInc * card.toNumber();
        if (this.ovlMemo[code] === undefined) {
            this.ovlMemo[code] = this.ovl.evaluate(this.getOvl(card, myCard)).get(0);
        }
        return this.ovlMemo[code];
    }

    subsetProb(ps, l) {
        let qs = new Array(ps.length + 1).fill(0);
        qs[0] = 1;
        for (let i = 0; i < ps.length; i++) {
            let prev = 0;
            for (let j = 0; j <= i + 1 && j <= l; j++) {
                let next = qs[j];
                qs[j] = prev * ps[i] + next * (1 - ps[i]);
                prev = next;
            }
        }
        return qs;
    }

    chooseBid(qs) {
        let bids = this.orderDesiredBids(qs);

        let choice = 0;
        if (bids[choice] == this.core.whatCanINotBid(this.player.getIndex())) {
            choice++;
        }

        return bids[choice];
    }

    orderDesiredBids(qs) {
        let n = qs.length - 1;

        let bidEPairs = new Array(n + 1);

        // my magical linear time algorithm
        for (let k = 0; k <= 1; k++) {
            bidEPairs[k] = [k, 0]
            for (let l = 0; l <= n; l++) {
                bidEPairs[k][1] += qs[l] * this.core.score(k, l);
            }
        }

        for (let k = 2; k <= n; k++) {
            bidEPairs[k] = [
                k,
                bidEPairs[k - 1][1] * 2
                    - bidEPairs[k - 2][1]
                    - 5
                    + qs[k - 2] * (14 - 4 * k + k * k)
                    + qs[k - 1] * (-27 + 4 * k - 2 * k * k)
                    + qs[k] * (10 + k * k)
            ];
        }

        bidEPairs.sort((pair1, pair2) => Math.sign(pair2[1] - pair1[1]));
        return bidEPairs.map(pair => pair[0]);
    }

    choosePlay(probs) {
        let bestProb = -1;
        let bestPlays = [];

        for (const pair of probs) {
            if (pair[1] > bestProb) {
                bestProb = pair[1];
                bestPlays = [];
            }
            if (pair[1] == bestProb) {
                bestPlays.push(pair[0]);
            }
        }

        return bestPlays[Math.floor(Math.random() * bestPlays.length)];
    }

    getOvl(card, myCard) {
        let vec = new ml.SparseVector();

        // this was my old system -- min values are weird
        vec.addOneHot('Current hand size', this.player.getHand().length - (myCard === undefined ? 0 : 1), 0, this.maxH);
        for (let i = 0; i < this.N; i++) {
            let j = (this.player.getIndex() + i) % this.N;
            vec.addOneHot(i + ' Bid', this.wants[j], -1, this.maxH);
        }
        vec.addOneHot('Void count', this.voidCount + (myCard !== undefined && this.suitCounts[myCard.suit] == 1 ? 1 : 0), -1, 3);
        vec.addOneHot('Trump unseen', this.seen.cardsLeftOfSuit(this.core.getTrump().suit), -1, 13 * this.D - 1);
        vec.addOneHot('Card is trump', card.suit == this.core.getTrump().suit ? 1 : 0, -1, 1);
        vec.addOneHot('Card\'s suit unseen', this.seen.cardsLeftOfSuit(card.suit), -1, 13 * this.D - 1);
        vec.addOneHot('Card\'s adjusted number', this.seen.cardValue(card), 0, 13 * this.D);
        vec.addOneHot('Card\'s matches unseen', this.seen.matchesLeft(card), 0, this.D - 1);

        return vec;
    }

    getIvl(card, requiredCancels) {
        let vec = new ml.SparseVector();

        let lead = this.player.getIndex() == this.core.getLeader() ? card : this.core.getLead();

        for (let i = 1; i < this.N; i++) {
            let j = (this.player.getIndex() + i) % this.N;
            let val = (this.player.getIndex() - this.core.getLeader() + this.N) % this.N + i < this.N ? this.wants[j] : -1;
            vec.addOneHot(i + ' Bid', val, -1, this.maxH);
        }
        vec.addOneHot('Trump unseen', this.seen.cardsLeftOfSuit(this.core.getTrump().suit), -1, 13 * this.D - 1);
        vec.addOneHot('Lead is trump', lead.suit == this.core.getTrump().suit ? 1 : 0, -1, 1);
        vec.addOneHot('Led suit unseen', this.seen.cardsLeftOfSuit(lead.suit), -1, 13 * this.D - 1);
        vec.addOneHot('Card is trump', card.suit == this.core.getTrump().suit ? 1 : 0, -1, 1);
        vec.addOneHot('Card\'s adjusted number', this.seen.cardValue(card), 0, 13 * this.D);
        vec.addOneHot('Card\'s matches unseen', this.seen.matchesLeft(card), 0, this.D - 1);
        vec.addOneHot('Required cancels', requiredCancels, 0, this.maxCancels);

        return vec;
    }
}

// entry point -----------------------------------------------------------------
function buildModules(count, N, D, T) {
    if (T != 0) {
        // TODO
    }

    return buildModulesOI(count, N, D);
}

function buildModulesOI(N, D) {
    let ovl = new ml.NNModel(`./models/N${N}/D${D}/T0/ovl.txt`, ['ReLu', 'Sigmoid']);
    let ivl = new ml.NNModel(`./models/N${N}/D${D}/T0/ivl.txt`, ['ReLu', 'Sigmoid']);
    let modules = new Array(N);
    for (let i = 0; i < N; i++) {
        modules[i] = new StrategyModuleOI(N, D, ovl, ivl);
    }
    return modules;
}

module.exports = {
    buildStrategyModules: buildModules,
    pointsMean: pointsMean,
    pointsVariance: pointsVariance
}
