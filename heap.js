// Taken from: https://gist.github.com/3088684

// Heap Queue for JavaScript: smallest as head
var Heap = function (less) {
    less = less || function (a, b) {return a < b};
    return Object.create(Heap.prototype, {
        buf: {value: []},
        less: {value: less},
    });
};
Heap.prototype.push = function (elem) {
    this.buf.push(elem);
    var index = this.buf.length - 1;
    while (index > 0) {
        var parent = (index - 1) >> 1;
        if (this.less(this.buf[index], this.buf[parent])) {
            this.buf[index] = this.buf[parent];
            this.buf[parent] = elem;
            index = parent;
        } else break;
    }
};
Heap.prototype.pop = function () {
    var ret = this.buf[0];
    var elem = this.buf.pop();
    if (this.buf.length === 0) return ret;
    this.buf[0] = elem;
    var index = 0;
    for (var l = index * 2 + 1; l < this.buf.length; l = index * 2 + 1) {
        var child = l;
        var r = l + 1;
        if (r < this.buf.length && this.less(this.buf[r], this.buf[l])) {
            child = r;
        }
        if (this.less(this.buf[child], elem)) {
            this.buf[index] = this.buf[child];
            this.buf[child] = elem;
            index = child;
        } else break;
    }
    return ret;
};
Heap.prototype.empty = function () {
    return this.buf.length === 0;
}

//example
/*
var data = [5,3,2,10,1,55,10,0,4];
var h = Heap();
data.forEach(h.push.bind(h));
var sorted = [];
while (!h.empty()) sorted.push(h.pop());
console.log(data);
console.log(sorted);
*/

exports.Heap = Heap;
