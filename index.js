var esprima = require('esprima');
var concatMap = require('concat-map');
var sourceOf = require('escodegen').generate;

module.exports = function (source) {
    var graph = {};
    var ast = esprima.parse(source, { range: true });
    return visit(ast).sort(cmp).reduce(uniq, []);
    
    function cmp (a, b) { return a.range[0] < b.range[0] ? -1 : 1 }
    function uniq (acc, x) {
        if (acc.length) {
            var r = acc[acc.length-1].range;
            var xr = x.range;
            if (xr[0] === r[0] && xr[1] === r[1]) return acc;
        }
        return acc.concat(x);
    }
};

function visit (node, parents) {
    if (parents === undefined) parents = [];
    
    var next = function (n, nx) {
        if (n.type === 'Extra') return n;
        return visit(n, parents.concat(nx || node));
    }
    
    if (node.type === 'Program') {
        return concatMap(node.body, function (n) {
            if (n.type === 'FunctionDeclaration') return []
            else return next(n)
        });
    }
    else if (node.type === 'ExpressionStatement') {
        return [].concat(
            extra(node.range[0], node.expression.range[0]),
            next(node.expression),
            extra(node.expression.range[1], node.range[1])
        );
    }
    else if (node.type === 'ReturnStatement') {
        return [].concat(
            extra(node.range[0], node.argument.range[0]),
            next(node.argument),
            extra(node.argument.range[1], node.range[1])
        );
    }
    else if (node.type === 'BlockStatement') {
        return [].concat(
            extra(node.range[0], node.body[0].range[0]),
            concatMap(node.body, next),
            extra(node.body[node.body.length-1].range[1], node.range[1])
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
    else if (node.type === 'BinaryExpression') {
        return [].concat(
            extra(node.range[0], node.left.range[0]),
            next(node.left),
            extra(node.left.range[1], node.right.range[0]),
            next(node.right),
            extra(node.right.range[1], node.range[1])
        );
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
    else if (node.type === 'Identifier') {
        var n = lookup(node.name, parents);
        if (n.node && n.node.type === 'FunctionDeclaration') {
            return [].concat(node, n.display, next(n.node.body, n.node));
        }
        else return [].concat(node, n.display);
    }
    else if (node.type === 'Literal') {
        return [ node ];
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
            var r = lookupBody(name, p);
            if (r) return r;
        }
        else if (p.type === 'FunctionDeclaration') {
            var args = p.params;
            for (var k = 0; k < args.length; k++) {
                if (args[k].name === name) {
                    if (args[k+1]) {
                        var comma = {
                            type: 'Comma',
                            range: [ args[k].range[1], args[k+1].range[0] ]
                        };
                        return {
                            display: [ args[k], comma ],
                            node: args[k]
                        };
                    }
                    else return { display: [ args[k] ], node: args[k] };
                }
            }
        }
        else if (p.type === 'FunctionExpression') {
            // TODO: search the arguments
        }
    }
    return { display: [], node: null };
}

function lookupBody (name, p)  {
    for (var j = 0; j < p.body.length; j++) {
        var node = p.body[j];
        
        if (node.type === 'FunctionDeclaration' && node.id.name === name) {
            var ps = node.params;
            var b = node.body, id = node.id;
            
            var display = [
                extra(node.range[0], id.range[1]),
                extra(id.range[1], (ps.length ? ps[0].range[0] : b.range[0])),
                extra(
                    (ps.length ? ps[ps.length-1].range[1] : id.range[1]),
                    b.range[0]
                ),
                trailing(j)
            ];
            return { display: display, node: node };
        }
        if (node.type === 'VariableDeclaration') {
            for (var k = 0; k < node.declarations.length; k++) {
                var ds = node.declarations;
                var d = ds[k];
                if (d.id.name === name) {
                    var display = [
                        extra(node.range[0], ds[0].range[0]),
                        d,
                        extra(ds[ds.length-1].range[1], node.range[1]),
                        trailing(j)
                    ];
                    return { display: display, node: node };
                }
            }
        }
    }
    
    function trailing (j) {
        var start = p.body[j].range[1];
        var end = p.body[j+1] ? p.body[j+1].range[0] : p.range[1];
        return extra(start, end);
    }
}

function isScoped (node) {
    return node.type === 'FunctionDeclaration'
        || node.type === 'FunctionExpression'
        || node.type === 'Program'
    ;
}
