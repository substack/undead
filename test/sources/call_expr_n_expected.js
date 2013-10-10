function f (n, g) {
    return g(n + 4);
}

console.log(f(3, function (x) { console.log(x) }));
