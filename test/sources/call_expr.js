function f (n, g) {
    return g(4);
}

console.log(f(3, function (x, y) { console.log(x) }));
