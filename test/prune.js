var undead = require('../');
var test = require('tape');
var fs = require('fs');

var files = [ 'simple.js' ];

test('compare against expected', function (t) {
    t.plan(files.length);
    files.forEach(function (file) {
        var sfile = __dirname + '/sources/' + file;
        var src = fs.readFileSync(sfile, 'utf8');
        var xfile = sfile.replace(/\.js$/, '_expected.js');
        var expected = fs.readFileSync(xfile, 'utf8');
        t.equal(undead(src).trim(), expected.trim(), file);
    });
});
