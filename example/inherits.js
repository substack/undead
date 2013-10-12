function Foo (x) { this.x = x }
function Bar () {}
Bar.prototype.bar = function () { return this.x * 111 }

var inherits = require('util').inherits;
inherits(Foo, Bar);

var f = new Foo(5);
console.log(f.bar());
