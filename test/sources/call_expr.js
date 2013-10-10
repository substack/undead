function f (n, g) {
    return g();
}

console.log(f(3, function (x, y) { console.log('!!!') }));
