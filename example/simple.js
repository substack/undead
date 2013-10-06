function f (n) {
    return n + 2;
}

function g (n) {
    return f(n) + 3;
}

function h (n) {
    return g(n) * 111;
}

console.log(f(4));
