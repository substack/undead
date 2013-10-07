var undead = require('../');
var concat = require('concat-stream');
var argv = require('optimist').boolean('v').argv;

process.stdin.pipe(concat(function (body) {
    var source = body.toString('utf8');
    console.log(undead(source, { tokens: argv.v }));
}));
