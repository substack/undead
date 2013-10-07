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
    
    var next = function (n) {
        if (n.type === 'Extra') return n;
        else if (n.type === 'FunctionDeclaration') {
            return [].concat(
                (n.params[0] ? extra(n.id.range[1], n.params[0].range[0]) : []),
                extra(
                    (n.params.length
                        ? n.params[n.params.length-1].range[1]
                        : n.id.range[1]
                    ),
                    n.body.range[0]
                ),
                visit(n.body, parents.concat(n))
            );
        }
        else return visit(n, parents.concat(node));
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
        return [].concat(
            node,
            n.display
        );
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
                    return {
                        display: [ args[k] ],
                        node: args[k]
                    };
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
        if (p.body[j].type === 'FunctionDeclaration'
        && p.body[j].id.name === name) {
            var ps = p.body[j].params;
            
            var display = [
                extra(p.body[j].range[0], p.body[j].id.range[1]),
                extra(
                    p.body[j].id.range[1],
                    (ps.length ? ps[0].range[0] : p.body[j].body.range[0])
                ),
                p.body[j].body,
                extra(
                    (ps.length 
                        ? ps[ps.length-1].range[1]
                        : p.body[j].id.range[1]
                    ),
                    p.body[j].body.range[0]
                ),
                trailing(j)
            ];
            return { display: display, node: p.body[j] };
        }
        if (p.body[j].type === 'VariableDeclaration') {
            for (var k = 0; k < p.body[j].declarations.length; k++) {
                var ds = p.body[j].declarations;
                var d = ds[k];
                if (d.id.name === name) {
                    var display = [
                        extra(p.body[j].range[0], ds[0].range[0]),
                        d,
                        extra(ds[ds.length-1].range[1], p.body[j].range[1]),
                        trailing(j)
                    ];
                    return { display: display, node: p.body[j] };
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
