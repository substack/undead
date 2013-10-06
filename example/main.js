function f (n, y) {
    return n + 2;
}

function g (n) {
    return f(n) + 3;
}

function h (n) {
    return g(n) * 111;
}

var obj = { h: h, f: f };
var x = 5;

console.log(obj.f(4) + x);
