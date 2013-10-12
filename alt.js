var esprima = require('esprima');
var concatMap = require('concat-map');

module.exports = function (src, opts) {
    if (!src) return '';
    if (!opts) opts = {};
    
    var visited = prune(src);
    if (opts.tokens) return visited;
    
    return visited.map(function (v, ix) {
        return src.slice(v.range[0], v.range[1]);
    }).join('');
};

function prune (src) {
    var graph = {};
    var ast = typeof src === 'string'
        ? esprima.parse(src, { range: true })
        : src
    ;
    var visited = visit(ast, [ ast ]).sort(cmp).reduce(uniq, []);
    return visited.filter(function (n, ix) {
        if (n.type !== 'Comma') return true;
        var nv = visited[ix+1];
        if (!nv) return false;
        if (nv.from === 'Param') {
            return nv.type === 'Identifier';
        }
        if (nv.type === 'Extra') {
            var s = src.slice(nv.range[0], nv.range[1]);
            return !/^\s*\)\s*$/.test(s);
        }
        return true;
    });
    
    function cmp (a, b) { return a.range[0] < b.range[0] ? -1 : 1 }
    function uniq (acc, x) {
        if (acc.length) {
            var r = acc[acc.length-1].range;
            var xr = x.range;
            if (xr[0] === r[0] && xr[1] === r[1]) return acc;
        }
        return acc.concat(x);
    }
}

function visit (node, scope) {
    if (node.type === 'Program') {
        return visitMap(node.body, scope);
    }
    else if (node.type === 'BlockStatement') {
        console.error('TODO');
        return [];
    }
    else if (node.type === 'FunctionDeclaration') {
        var vars = node.params.reduce(function (acc, param) {
            acc[param.name] = param;
            return acc;
        }, {});
        return visitMap(node.body, scope.concat(vars));
    }
    else if (node.type === 'VariableDeclaration') {
        var tscope = scope[scope.length-1];
        var ds = node.declarations.filter(function (d) {
            tscope[d.id.name] = d;
            return hasSideEffects(d);
        });
        return [];
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
            visit(node.callee, scope),
            extra(node.callee.range[1], args[0]
                ? args[0].range[0] : node.range[1]
            ),
            concatMap(args, function (arg, ix) {
                
                
                
                //scope[scope.length-1][
                //if (args[ix+1]) args[ix+1]
                
                if (hasSideEffects(arg)) {
                    return visit(arg, scope);
                }
                return [];
            }),
            extra(
                args.length
                    ? args[args.length-1].range[1]
                    : node.callee.range[1]
                ,
                node.range[1]
            )
        );
    }
    else if (node.type === 'MemberExpression') {
        return [].concat(
            extra(node.range[0], node.object.range[0]),
            visit(node.object, scope),
            extra(node.object.range[1], node.property.range[0]),
            visit(node.property),
            extra(node.property.range[1], node.range[1])
        );
    }
    else if (node.type === 'Identifier') {
        return [ node ];
    }
    return [];
    
    function visitMap (nodes, ps) {
        return concatMap(node.body, function (x) { return visit(x, ps) });
    }
}

function extra (a, b) {
    return { type: 'Extra', range: [ a, b ] };
}

function hasSideEffects (x) {
    if (x.type === 'CallExpression') return true;
    if (x.type === 'AssignmentExpression') return true;
    if (x.type === 'BinaryExpression') {
        return hasSideEffects(x.left) || hasSideEffects(x.right);
    }
    if (x.type === 'UnaryExpression') {
        return hasSideEffects(x.argument);
    }
    if (x.type === 'MemberExpression') {
        return hasSideEffects(x.property) || hasSideEffects(x.object);
    }
    return false;
}
