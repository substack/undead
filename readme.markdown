# undead

kill dead code

# example

Here is some simple code:

``` js
function f (n) {
    return n + 2;
}

function g (n) {
    return f(n) + 3;
}

function h (n) {
    return g(n) * 111;
}

var obj = { h: h, f: f };

console.log(obj.f(4));
```

undead kills the dead code where it stands:

```
$ undead < example/main.js
function f (n) {
    return n + 2;
}

console.log(f(4));
```

uglifyjs (2.4.0) isn't very good at optimizing this away, even though the
property lookup is statically resolvable:

```
$ uglifyjs --wrap -cm < example/main.js
!function(n,t){function r(n){return n+2}function u(n){return r(n)+3}function o(n){return 111*u(n)}t["true"]=n;var f={h:o,f:r};console.log(f.f(4))}({},function(){return this}());
```

What's up with that?
