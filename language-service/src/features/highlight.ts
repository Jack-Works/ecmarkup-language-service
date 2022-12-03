import type {
    TextDocuments,
    Connection,
    SemanticTokensClientCapabilities,
    ServerCapabilities,
    SemanticTokensLegend,
    SemanticTokens,
} from 'vscode-languageserver/node.js'
import type { SourceFile } from '../utils/document.js'
import type { AlgorithmElementWithTree } from '../../ecmarkup/lib/Algorithm.js'
import { type PathItem, type Expr, parse as parseExpr, walk as walkExpr } from '../../ecmarkup/lib/expr-parser.js'
import type { OrderedListNode } from 'ecmarkdown'
import { offsetToLineAndColumn } from '../../ecmarkup/lib/utils.js'

export function semanticTokensProvider(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
    cap: SemanticTokensClientCapabilities | undefined
): ServerCapabilities['semanticTokensProvider'] {
    if (!cap) return undefined
    connection.languages.semanticTokens.on(async (params) => {
        const doc = documents.get(params.textDocument.uri)
        if (!doc) return { data: [] }

        await doc.build()
        const result: SemanticTokens = { data: Array.from(getRelativeToken(doc)) }
        return result
    })
    return {
        legend: SemanticTokenLegend,
        full: true,
        range: false,
        workDoneProgress: false,
    }
}

type SemanticToken = [
    lineOffset: number,
    charOffset: number,
    length: number,
    kind: TokenTypes,
    modifier: TokenModifiers
]
function* getRelativeToken(sourceFile: SourceFile) {
    let prevLine = 0
    let prevCol = 0
    // for (const token of [...visitor(document)].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    for (const token of visitor(sourceFile)) {
        if (token[0] === prevLine) {
            prevLine = token[0]
            const col = token[1]
            token[0] = 0
            token[1] = token[1] - prevCol
            prevCol = col
        } else {
            const line = token[0]
            token[0] = line - prevLine
            prevLine = line
            prevCol = token[1]
        }
        yield* token
    }
}

function* visitor(sourceFile: SourceFile): Generator<SemanticToken, void, undefined> {
    for (const n of sourceFile.node.doc.querySelectorAll('emu-alg')) {
        const node = n as AlgorithmElementWithTree
        if (!('ecmarkdownTree' in node) || !node.ecmarkdownTree) continue

        const tree = node.ecmarkdownTree
        const originalHtml = node.originalHtml

        const tokens: SemanticToken[] = []
        function addSemanticToken(
            item: { location: { start: { line: number; column: number } | { offset: number } } },
            length: number,
            offset: number,
            type: TokenTypes
        ) {
            if ('offset' in item.location.start) {
                const { line, column } = offsetToLineAndColumn(originalHtml, item.location.start.offset)
                const pos = sourceFile.relativeToPos(node, line, column + offset)
                if (!pos) return
                tokens.push(createSemanticToken(pos.line, pos.character, length, type))
            } else {
                const pos = sourceFile.relativeToPos(
                    node,
                    item.location.start.line,
                    item.location.start.column + offset
                )

                if (!pos) return
                tokens.push(createSemanticToken(pos.line, pos.character, length, type))
            }
        }

        function expressionVisitor(expr: Expr) {
            if (expr.type === 'fragment') {
                const frag = expr.frag
                if (frag.name === 'comment') addSemanticToken(frag, frag.contents.length, 0, TokenTypes.comment)
                else if (frag.name === 'underscore') {
                    if (frag.contents.length === 1 && frag.contents[0] && frag.contents[0].name === 'text') {
                        addSemanticToken(frag, frag.contents[0].contents.length, 1, TokenTypes.variable)
                    }
                } else if (frag.name === 'pipe') {
                    addSemanticToken(frag, frag.nonTerminal.length, 1, TokenTypes.variable)
                } else if (frag.name === 'tilde') {
                    if (frag.contents.length === 1 && frag.contents[0] && frag.contents[0].name === 'text') {
                        addSemanticToken(frag, frag.contents[0].contents.length, 1, TokenTypes.string)
                    }
                } else if (frag.name === 'star') {
                    if (frag.contents.length === 1 && frag.contents[0]) {
                        const node = frag.contents[0]
                        if (node.name === 'text') {
                            let tokenType = TokenTypes.variable
                            if (node.contents === 'true' || node.contents === 'false') tokenType = TokenTypes.boolean
                            else if (node.contents.startsWith('"') && node.contents.endsWith('"'))
                                tokenType = TokenTypes.string
                            addSemanticToken(node, node.contents.length, 0, tokenType)
                        }
                    }
                } else if (frag.name === 'text') {
                    const text = frag.contents.trim().toLowerCase()
                    if (text === 'if' || text === ', then' || text === 'else,' || text === 'else if') {
                        addSemanticToken(frag, frag.contents.length, 0, TokenTypes.if)
                    } else if (text === 'assert:' || text === 'asserts:') {
                        addSemanticToken(frag, frag.contents.length, 0, TokenTypes.if)
                    } else if (text === 'is' || text === 'is not') {
                        addSemanticToken(frag, frag.contents.length, 0, TokenTypes.eq)
                    } else if (text === 'let' || text === 'set') {
                        addSemanticToken(frag, frag.contents.length, 0, TokenTypes.var)
                    } else if (text === 'return') {
                        addSemanticToken(frag, frag.contents.length, 0, TokenTypes.return)
                    } else if (text === 'repeat,' || text === 'for each element') {
                        addSemanticToken(frag, frag.contents.length, 0, TokenTypes.loop)
                    }
                }
            } else if (expr.type === 'call' || expr.type === 'sdo-call') {
                const { callee, arguments: args } = expr
                if (callee.length === 1 && callee[0].name === 'text') {
                    addSemanticToken(callee[0], callee[0].contents.length, 0, TokenTypes.function)
                }
            }
        }
        function walkLines(list: OrderedListNode) {
            for (const line of list.contents) {
                const item = parseExpr(line.contents, sourceFile.node.biblio.getOpNames('namespace?'))
                if (item.type === 'failure') continue
                else walkExpr(expressionVisitor, item)

                if (line.sublist?.name === 'ol') walkLines(line.sublist)
            }
        }
        walkLines(tree.contents)
        yield* tokens
    }
}

function createSemanticToken(
    line: number,
    char: number,
    length: number,
    kind: TokenTypes,
    modifier: TokenModifiers = TokenModifiers.None
): SemanticToken {
    return [line, char, length, kind, modifier]
}

enum TokenTypes {
    type,
    parameter,
    variable,
    property,
    function,
    comment,
    string,
    number,
    eq,
    element,
    algorithm,
    primitive,
    boolean,
    if,
    assert,
    var,
    return,
    loop,
}
enum TokenModifiers {
    None,
}
const SemanticTokenLegend: SemanticTokensLegend = {
    tokenModifiers: Object.keys(TokenModifiers).slice(-Object.keys(TokenModifiers).length / 2),
    tokenTypes: Object.keys(TokenTypes).slice(-Object.keys(TokenTypes).length / 2),
}
