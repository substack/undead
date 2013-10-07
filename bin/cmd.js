var undead = require('../');
var concat = require('concat-stream');
var argv = require('optimist').boolean('v').argv;

process.stdin.pipe(concat(function (body) {
    var source = body.toString('utf8');
    var visited = undead(source);
    if (argv.v) console.log(visited);
    else {
        console.log(visited.map(function (v, ix) {
            if (v.type === 'Comma' && visited[ix+1]
            && visited[ix+1].type !== 'Identifier') {
                return;
            }
            
            return source.slice(v.range[0], v.range[1]);
        }).join(''));
    }
}));
