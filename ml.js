var fs = require('fs');

// vector and matrix
class BasicVector {
    constructor(vec) {
        this.vec = vec;
    }

    fromString(str) {
        this.vec = str.substring(1, str.length - 1)
                        .split(', ')
                        .map(parseFloat);
        return this;
    }

    size() {
        return this.vec.length;
    }

    isSparse() {
        return false;
    }

    toArray() {
        return this.vec;
    }

    scale(s) {
        for (let i = 0; i < this.size(); i++) {
            this.vec[i] *= s;
        }
    }

    applyMatrix(M) {
        return M.applyVector(this);
    }

    dot(vector) {
        if (this.size() != vector.size()) {
            throw 'Attempted to dot vectors of size ' + this.size() + ' and ' + vector.size() + '.';
        }

        if (vector.isSparse()) {
            return vector.dot(this);
        } else {
            let vec1 = vector.toArray();
            let ans = 0;
            for (let i = 0; i < this.size(); i++) {
                ans += this.vec[i] * vec1[i];
            }
            return ans;
        }
    }

    add(vector, scale) {
        if (arguments.length == 1) {
            scale = 1;
        }

        if (this.size() != vector.size()) {
            throw 'Attempted to add vectors of size ' + this.size() + ' and ' + vector.size() + '.';
        }

        let vec1 = vector.toArray();
        for (let i = 0; i < this.size(); i++) {
            this.vec[i] += scale * vec1[i];
        }
        return this;
    }

    get(i) {
        return this.vec[i];
    }

    entryWiseEquals(vector) {
        if (this.size() != vector.size()) {
            return false;
        }

        let vec1 = vector.toArray();
        for (let i = 0; i < this.size(); i++) {
            if (this.vec[i] != vec1[i]) {
                return false;
            }
        }
        return true;
    }

    copy() {
        let vec1 = this.vec.map(x => x);
        return new BasicVector(vec1);
    }
}

class SparseVector {
    constructor(entries, size) {
        if (arguments.length > 0) {
            this.entries = entries;
            this.totalSize = size;
        } else {
            this.entries = [];
            this.totalSize = 0;
        }
    }
    size() {
        return this.totalSize;
    }

    isSparse() {
        return true;
    }

    toArray() {
        let arr = new Array(totalSize).fill(0);
        for (const entry of entries) {
            arr[entry.key] = entry.value;
        }
        return arr;
    }

    getEntries() {
        return this.entries;
    }

    scale(s) {
        for (const entry of entries) {
            entry.value *= s;
        }
    }

    applyMatrix(M) {
        return M.applyVector(this);
    }

    dot(vector) {
        if (this.size() != vector.size()) {
            throw 'Attempted to dot vectors of size ' + this.size() + ' and ' + vector.size() + '.';
        }

        if (vector.isSparse()) {
            return vector.dot(this);
        } else {
            let vec1 = vector.toArray();
            let ans = 0;
            for (let i = 0; i < this.size(); i++) {
                ans += this.vec[i] * vec1[i];
            }
            return ans;
        }
    }

    entryWiseEquals(vector) {
        if (this.size() != vector.size()) {
            return false;
        }

        let vec0 = this.toArray();
        let vec1 = vector.toArray();
        for (let i = 0; i < this.size(); i++) {
            if (vec0[i] != vec1[i]) {
                return false;
            }
        }
        return true;
    }

    copy() {
        let entries1 = this.entries.map(x => x);
        return new SparseVector(entries1, this.totalSize);
    }

    addOneHot(feature, val, min, max) {
        if (val < min || val > max) {
            throw 'Invalid value ' + val + ' for one-hot in [' + min + ', ' + max + '].';
        }
        //console.log(feature, val, min, max);
        if (val != min) {
            this.entries.push({key: this.totalSize + val - min - 1, value: 1});
        }
        this.totalSize += max - min;
    }
}

class BasicMatrix {
    constructor(mat) {
        this.matrix = mat;
    }

    fromString(str) {
        this.matrix = str.substring(1, str.length - 1)
                        .split(', \n')
                        .map(row => row.substring(1, row.length - 1)
                                        .split(', ')
                                        .map(parseFloat));
        return this;
    }

    numRows() {
        return this.matrix.length;
    }

    numCols() {
        return this.matrix[0].length;
    }

    toArray() {
        return matrix;
    }

    get(i, j) {
        return matrix[i][j];
    }

    applyVector(vector) {
        if (vector.size() != this.numCols()) {
            throw 'Attempted to multiply a ' + this.numRows() + '-by-' + this.numCols() + ' matrix by a ' + vector.size() + '-by-1 vector.';
        }

        let ans = new Array(this.numRows()).fill(0);

        if (vector.isSparse()) {
            for (let i = 0; i < this.numRows(); i++) {
                for (const entry of vector.getEntries()) {
                    ans[i] += this.matrix[i][entry.key] * entry.value;
                }
            }
        } else {
            let arr = vector.toArray();
            for (let i = 0; i < this.numRows(); i++) {
                for (let j = 0; j < this.numCols(); j++) {
                    ans[i] += this.matrix[i][j] * arr[j];
                }
            }
        }

        return new BasicVector(ans);
    }

    add(matrix, scale) {
        if (arguments.length == 1) {
            scale = 1;
        }

        if (this.numRows() != vector.numRows() || this.numCols() != vector.numCols()) {
            throw 'Attempted to add matrices of size ' + this.numRows() + '-by-' + this.numCols() + ' and ' + matrix.numRows() + '-by-' + matrix.numCols() + '.';
        }

        for (let i = 0; i < this.numRows(); i++) {
            for (let j = 0; j < this.numCols(); j++) {
                this.matrix[i][j] += matrix.get(i, j) * scale;
            }
        }
        return this;
    }

    scaledCol(j, scale) {
        let ans = new Array(this.numRows());
        for (let i = 0; i < this.numRows(); i++) {
            ans[i] = this.matrix[i][j] * scale;
        }
        return new BasicVector(ans);
    }
}

class DiagonalMatrix {
    constructor(arr) {
        this.diagonal = arr;
    }

    numRows() {
        return this.diagonal.length;
    }

    numCols() {
        return this.diagonal.length;
    }

    toArray() {
        let ans = new Array(this.diagonal.length);
        for(let i = 0; i < this.diagonal.length; i++) {
            let row = new Array(this.diagonal.length);
            row[i] = this.diagonal[i];
            ans[i] = row;
        }
        return ans;
    }

    get(i, j) {
        return i == j ? this.diagonal[i] : 0;
    }

    applyVector(vector) {
        if (vector.size() != this.numCols()) {
            throw 'Attempted to multiply a ' + this.numRows() + '-by-' + this.numCols() + ' matrix by a ' + vector.size() + '-by-1 vector.';
        }

        if (vector.isSparse()) {
            let ans = [];
            for (const entry of vector.getEntries()) {
                let val = entry.value * this.diagonal[entry.key];
                if (val != 0) {
                    ans.push({key: entry.key, value: val});
                }
            }
            return new SparseVector(ans, vector.size());
        } else {
            let arr = vector.toArray();
            let ans = new Array(vector.length);
            let allZeros = true;
            for (let i = 0; i < arr.length; i++) {
                ans[i] = this.diagonal[i] * arr[i];
                allZeros = allZeros && (ans[i] == 0);
            }
            if (allZeros) {
                return new SparseVector([], vector.size());
            } else {
                return new BasicVector(ans);
            }
        }

        return new BasicVector(ans);
    }

    scaledCol(j, scale) {
        let ans = [];
        let val = this.diagonal[j] * scale;
        if (val != 0) {
            ans.push({key: j, value: val});
        }
        return new SparseVector(ans, this.diagonal.length);
    }
}

// activation functions
class SplitActivationFunction {
    constructor() {}

    a(v) {
        let arr = v.toArray();
        let ans = new Array(arr.length);
        for (let i = 0; i < arr.length; i++) {
            ans[i] = this.f(arr[i]);
        }
        return new BasicVector(ans);
    }

    da(v) {
        let ans = new Array(v.size()).fill(0);

        if (v.isSparse()) {
            for (const entry of v.getEntries()) {
                ans[entry.key] = this.df(entry.value());
            }
        } else {
            for (let i = 0; i < v.size(); i++) {
                ans[i] = this.df(v.get(i));
            }
        }

        return new DiagonalMatrix(ans);
    }
}

class ReLu extends SplitActivationFunction {
    constructor() {super();}

    f(x) {
        return x < 0 ? 0 : x;
    }

    df(x) {
        return x < 0 ? 0 : 1;
    }
}

class Sigmoid extends SplitActivationFunction {
    constructor() {super();}

    f(x) {
        return 1 / (1 + Math.exp(-x));
    }

    df(x) {
        return 1 / (2 + Math.exp(x) + Math.exp(-x));
    }
}

class Softmax {
    constructor() {
        this.memo = undefined;
        this.denom = 1;
    }

    memoize(v) {
        if (memo !== v) {
            this.memo = v;
            this.denom = 0;
            for (const x of v.toArray()) {
                this.denom += Math.exp(x);
            }
        }
    }

    a(v) {
        this.memoize(v);
        let arr = v.toArray();
        let ans = new Array(arr.length);
        for (let i = 0; i < arr.length; i++) {
            ans[i] = Math.exp(arr[i]) / denom;
        }
        return new BasicVector(ans);
    }

    da(v) {
        this.memoize(v);
        let arr = v.toArray();
        let ans = new Array(arr.length);
        for (let i = 0; i < arr.length; i++) {
            let row = new Array(arr.length);
            for (let j = 0; j < arr.length; j++) {
                if (i == j) {
                    row[j] = Math.exp(arr[i]) / this.denom - Math.exp(2 * arr[i]) / Math.pow(this.denom, 2);
                } else {
                    row[j] = -Math.exp(arr[i] + arr[j]) / Math.pow(this.denom, 2);
                }
            }
            ans[i] = row;
        }
        return new BasicMatrix(ans);
    }
}

// neural networks
class Layer {
    constructor(w, b) {
        this.input = arguments.length == 0;

        this.w = w;
        this.b = b;
    }

    setActivationFunction(af) {
        this.af = af;
    }

    compute(v) {
        if (this.input) {
            return v;
        } else {
            return this.af.a(v.applyMatrix(this.w).add(this.b));
        }
    }
}

class NNModel {
    constructor(path, afs) {
        this.layers = [new Layer()];

        let data = fs.readFileSync(path, 'utf8');

        let mats = data.split('\n\n');
        for (let i = 0; i < mats.length; i += 2) {
            if (mats[i].length == 0 || mats[i + 1].length == 0) {
                break;
            }
            let w = new BasicMatrix().fromString(mats[i]);
            let b = new BasicVector().fromString(mats[i + 1]);
            this.layers.push(new Layer(w, b));
        }

        for (let i = 0; i < afs.length; i++) {
            this.layers[i + 1].setActivationFunction(this.getActivationFunction(afs[i]));
        }
    }

    getActivationFunction(name) {
        switch (name) {
            case 'ReLu':
                return new ReLu();
            case 'Sigmoid':
                return new Sigmoid();
            case 'Softmax':
                return new Softmax();
        }
    }

    evaluate(v) {
        let ans = v;
        for (const layer of this.layers) {
            ans = layer.compute(ans);
        }
        return ans;
    }
}

module.exports = {
    BasicVector: BasicVector,
    SparseVector: SparseVector,
    NNModel: NNModel
}
