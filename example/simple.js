function f (n, j, k) {
    return n + 2 * j;
}

function g (n) {
    return f(n) + 3;
}

function h (n) {
    return g(n) * 111;
}

var n = 5;
console.log(f(4, n));
