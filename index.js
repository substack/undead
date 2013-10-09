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
    var visited = visit(ast).sort(cmp).reduce(uniq, []);
    return visited.filter(function (n, ix) {
        if (n.type !== 'Comma') return true;
        var nv = visited[ix+1];
        if (!nv) return false;
        if (nv.from === 'Param') {
            return nv.type === 'Identifier';
        }
        return nv.type !== 'Extra';
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
};

function visit (node, parents) {
    if (parents === undefined) parents = [];
    
    var next = function (n, nx) {
        if (n.type === 'Extra' || n.type === 'Comma') return n;
        return visit(n,
            nx || node.type === 'CallExpression' || node.type === 'Program'
            ? parents.concat(nx || node)
            : parents
        );
    };
    
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
        if (node.body.length === 0) return node;
        return [].concat(
            extra(node.range[0], node.body[0].range[0]),
            concatMap(node.body, next),
            extra(node.body[node.body.length-1].range[1], node.range[1])
        );
    }
    else if (node.type === 'CallExpression') {
        var args = node.arguments;
        if (args.length === 0) return [ node ];
        
        var nodes = concatMap(args, function (x, i) {
            var resolved = resolveArg(i, node, parents);
            if (!resolved && !hasSideEffects(x)) return [];
            
            if (!args[i+1]) return (resolved || []).concat(x);
            var comma = {
                type: 'Comma',
                range: [ x.range[1], args[i+1].range[0] ]
            };
            return (resolved || []).concat(x, comma);
        });
        return [].concat(
            extra(node.range[0], node.callee.range[0]),
            next(node.callee),
            extra(node.callee.range[1], args[0].range[0]),
            concatMap(nodes, next),
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
    else if (node.type === 'UnaryExpression') {
        return [].concat(
            extra(node.range[0], node.argument.range[0]),
            next(node.argument),
            extra(node.argument.range[1], node.range[1])
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
        var x = n.node && n.node[n.node.length-1];
        var t = x && x.type;
        if (t === 'FunctionDeclaration' || t === 'FunctionExpression') {
            return [].concat(
                node,
                n.display,
                next(x.body, x),
                concatMap(n.node.slice(1), next)
            );
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
        else if (p.type === 'FunctionDeclaration'
        || p.type === 'FunctionExpression') {
            var args = p.params;
            for (var k = 0; k < args.length; k++) {
                if (args[k].name !== name) continue;
                var caller = parents[i-1];
                var display = [ args[k] ];
                
                if (args[k+1]) display.push({
                    type: 'Comma',
                    from: 'Param',
                    range: [ args[k].range[1], args[k+1].range[0] ]
                });
                var nodes = [ args[k] ];
                if (caller && caller.arguments[k]) {
                    var ca = caller.arguments[k];
                    var nca = caller.arguments[k+1];
                    
                    if (ca.type === 'FunctionExpression' && ca.params.length) {
                        display.push(extra(ca.range[0], ca.params[0].range[0]));
                        display.push(extra(
                            ca.params[ca.params.length-1].range[1],
                            ca.body.range[0]
                        ));
                    }
                    else if (ca.type === 'FunctionExpression') {
                        display.push(extra(ca.range[0], ca.body.range[0]));
                    }
                    else display.push(ca);
                    nodes.push(ca);
                    
                    if (nca) {
                        display.push({
                            type: 'Comma',
                            from: 'Param',
                            range: [ ca.range[1], nca.range[0] ]
                        });
                    }
                }
                return { display: display, node: nodes };
            }
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
            return { display: display, node: [ node ] };
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
                    return { display: display, node: [ node ] };
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

function resolveArg (ix, node, parents) {
    var x = lookup(node.callee.name, parents);
    if (!x) return null;
    if (x.node && x.node[1] && x.node[1].params && x.node[1].params[ix]) {
        return [ x.node[1].params[ix] ];
    }
    return null;
}
