function f (g) {
    return g(4);
}

console.log(f(function (x) { console.log(x) }));
