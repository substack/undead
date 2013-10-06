var esprima = require('esprima');
var concatMap = require('concat-map');

var SOURCE;
module.exports = function (source) {
    var graph = {};
    var ast = esprima.parse(source, { range: true });
SOURCE = source.toString('utf8');
    return visit(ast).sort(cmp);
    
    function cmp (a, b) { return a.range[0] < b.range[0] ? -1 : 1 }
};

function visit (node) {
    if (node.type === 'Program') {
        return concatMap(node.body, visit);
    }
    else if (node.type === 'ExpressionStatement') {
        return [].concat(
            extra(node.range[0], node.expression.range[0]),
            visit(node.expression),
            extra(node.expression.range[1], node.range[1])
        );
    }
    else if (node.type === 'CallExpression') {
        var args = node.arguments;
        return [].concat(
            extra(node.range[0], node.callee.range[0]),
            visit(node.callee),
            extra(node.callee.range[1], args[0].range[0]),
            concatMap(args, visit),
            extra(args[args.length-1].range[1], node.range[1])
        );
    }
    else if (node.type === 'Identifier') {
        return [ node ];
    }
    else if (node.type === 'MemberExpression') {
        return [].concat(
            extra(node.range[0], node.object.range[0]),
            visit(node.object),
            extra(node.object.range[1], node.property.range[0]),
            visit(node.property),
            extra(node.property.range[1], node.range[1])
        );
    }
    else return [];
}

function extra (a, b) {
    return { type: 'Extra', range: [ a, b ] };
}
