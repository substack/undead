var esprima = require('esprima');
var concatMap = require('concat-map');

module.exports = function (source) {
    var graph = {};
    var ast = esprima.parse(source, { range: true });
    return visit(ast).sort(cmp);
    
    function cmp (a, b) { return a.range[0] < b.range[0] ? -1 : 1 }
};

function visit (node, parents) {
    if (parents === undefined) parents = [];
    var next = function (n) { return visit(n, parents.concat(node)) }
    
    if (node.type === 'Program') {
        return concatMap(node.body, next);
    }
    else if (node.type === 'ExpressionStatement') {
        return [].concat(
            extra(node.range[0], node.expression.range[0]),
            next(node.expression),
            extra(node.expression.range[1], node.range[1])
        );
    }
    else if (node.type === 'CallExpression') {
        var args = node.arguments;
        return [].concat(
            extra(node.range[0], node.callee.range[0]),
            next(node.callee),
            extra(node.callee.range[1], args[0].range[0]),
            concatMap(args, next),
            extra(args[args.length-1].range[1], node.range[1])
        );
    }
    else if (node.type === 'Identifier') {
        var n = lookup(node.name, parents);
        return [ node ].concat(n);
    }
    else if (node.type === 'Literal') {
        return [ node ];
    }
    else if (node.type === 'MemberExpression') {
        return [].concat(
            extra(node.range[0], node.object.range[0]),
            next(node.object),
            extra(node.object.range[1], node.property.range[0]),
            next(node.property),
            extra(node.property.range[1], node.range[1])
        );
    }
    else return [];
}

function extra (a, b) {
    return { type: 'Extra', range: [ a, b ] };
}

function lookup (name, parents) {
    for (var i = parents.length - 1; i >= 0; i--) {
        var p = parents[i];
        if (p.type === 'Program') {
            var l = looker(p);
            if (l) return l;
        }
    }
    
    function looker (p)  {
        for (var j = 0; j < p.body.length; j++) {
            if (p.body[j].type === 'FunctionDeclaration'
            && p.body[j].id.name === name) {
                var start = p.body[j].range[1];
                var end = p.body[j+1] ? p.body[j+1].range[0] : p.range[1];
                return [ p.body[j], extra(start, end) ];
            }
            if (p.body[j].type === 'VariableDeclaration') {
                // TODO
                console.error('TODO', p.body[j]);
            }
        }
    }
    
    return [];
}
