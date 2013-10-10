function f (g) {
    return g();
}

console.log(f(function () { console.log('!!!') }));
