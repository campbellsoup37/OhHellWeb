var ml = require('./ml');

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
        this.ovl = ovl;
        this.ivl = ivl;
    }

    setCoreAndPlayer(core, player) {
        this.core = core;
        this.player = player;
    }

    makeBid() {
        this.loadSlowFeatures();

        let qs = this.getQs(this.player.getHand().length);
        let myBid = this.chooseBid(qs);

        return myBid;
    }

    makePlay() {
        let myPlay = undefined;

        if (this.player.getHand().length == 1) {
            myPlay = this.player.getHand()[0];
        } else {
            let makingProbs = this.getMakingProbs();
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
        
    }

    loadSlowFeatures() {
        let myHand = this.player.getHand();

        this.seen = this.core.getHandCollection(this.player.getIndex());
        this.seen.merge(this.core.getTrickCollection());
        this.seen.merge(this.core.getSeenCollection());

        console.log(this.seen.toArray().map(c => c.toString()));

        let suitCounts = [0, 0, 0, 0];
        for (const card of myHand) {
            suitCounts[card.suit]++;
        }
        this.voidCount = 0;
        for (let count of suitCounts) {
            if (count == 0) {
                this.voidCount++;
            }
        }

        this.ovlMemo = {};
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
            console.log(qs);
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
        console.log(bidEPairs);
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

        // this was my old system -- mvecs are weird
        vec.addOneHot('Current hand size', this.player.getHand().length - (myCard === undefined ? 0 : 1), 0, this.maxH);

        for (let i = 0; i < this.N; i++) {
            let j = (this.player.getIndex() + i) % this.N;
            vec.addOneHot(i + ' Bid', this.core.wants(j), -1, this.maxH);
        }

        vec.addOneHot('Void count', this.voidCount + (myCard !== undefined && this.suitCounts[myCard.suit] == 1 ? 1 : 0), -1, 3);
        vec.addOneHot('Trump unseen', this.seen.cardsLeftOfSuit(this.core.getTrump().suit), -1, 13 * this.D - 1);

        vec.addOneHot('Card is trump', card.suit == this.core.getTrump().suit ? 1 : 0, -1, 1);
        vec.addOneHot('Card\'s suit unseen', this.seen.cardsLeftOfSuit(card.suit), -1, 13 * this.D - 1);

        vec.addOneHot('Card\'s adjusted number', this.seen.cardValue(card), 0, 13 * this.D);
        vec.addOneHot('Card\'s matches unseen', this.seen.matchesLeft(card), 0, this.D - 1);

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

function buildModulesOI(count, N, D) {
    let ovl = new ml.NNModel(`./models/N${N}/D${D}/T0/ovl.txt`, ['ReLu', 'Sigmoid']);
    let ivl = new ml.NNModel(`./models/N${N}/D${D}/T0/ivl.txt`, ['ReLu', 'Sigmoid']);
    let modules = new Array(count);
    for (let i = 0; i < count; i++) {
        modules[i] = new StrategyModuleOI(N, D, ovl, ivl);
    }
    return modules;
}

module.exports = {
    buildStrategyModules: buildModules
}
