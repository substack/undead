function f (n, j, k) {
    return n + 2 * k;
}

function g (n) {
    return f(n) + 3;
}

function h (n) {
    return g(n) * 111;
}

console.log(f(4, 1));
