import type {
    Connection,
    SemanticTokensParams,
    SemanticTokensRangeParams,
    ServerCapabilities,
    TextDocuments,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { isOp, resolve_biblio } from '../utils/biblio.js'
import { getSourceFile } from '../utils/parse.js'
import type { Node } from 'vscode-html-languageservice'

export function semanticTokensProvider(
    connection: Connection,
    documents: TextDocuments<TextDocument>
): NonNullable<ServerCapabilities['semanticTokensProvider']> {
    async function getTokens(params: SemanticTokensParams | SemanticTokensRangeParams) {
        const document = documents.get(params.textDocument.uri)
        if (!document) return { data: [] }
        const resolved_biblio = await resolve_biblio(connection, params.textDocument.uri)
        const sourceFile = getSourceFile.get(document)
        const data: number[] = []
        let lastLine: number
        let lastChar: number

        function insertToken(
            offset: number,
            length: number,
            tokenType: SemanticTokenTypes,
            modifier: SemanticTokenModifiers[]
        ) {
            const { line, character } = document!.positionAt(offset)
            if (data.length === 0) {
                data.push(line, character, length, tokenType, modifierToArray(modifier))
            } else {
                if (line < lastLine || (line === lastLine && character < lastChar)) {
                    throw new Error('Semantics tokens have wrong order. Please open an issue.')
                }
                data.push(
                    line - lastLine,
                    line === lastLine ? character - lastChar : character,
                    length,
                    tokenType,
                    modifierToArray(modifier)
                )
            }
            lastLine = line
            lastChar = character
        }

        function visitor(node: Node) {
            if ('range' in params) {
                const from = document!.offsetAt(params.range.start)
                const until = document!.offsetAt(params.range.end)
                if (node.end < from || node.start > until) return
            }
            if (node.tag === 'emu-alg') {
                for (const { index, 1: word } of sourceFile.getNodeText(node).matchAll(/(\b\w+\b)\(/g)) {
                    if (
                        resolved_biblio.entries
                            .filter(isOp)
                            .find((x) => x.aoid === word)
                            ?.effects.includes('user-code')
                    ) {
                        insertToken(node.startTagEnd! + index!, word!.length, SemanticTokenTypes.variable, [
                            SemanticTokenModifiers.mutable,
                        ])
                    }
                }
            } else node.children.forEach(visitor)
        }
        sourceFile.html.roots.forEach(visitor)

        return { data }
    }

    connection.languages.semanticTokens.on(getTokens)
    connection.languages.semanticTokens.onRange(getTokens)
    return {
        full: { delta: false },
        range: true,
        legend: {
            tokenTypes: Object.keys(SemanticTokenTypes).filter((x) => !x.match(/\d/)),
            tokenModifiers,
        },
    }
}

function modifierToArray(modifiers: readonly SemanticTokenModifiers[]) {
    let bitflag = 0
    for (let index = 0; index < tokenModifiers.length; index++) {
        const key = tokenModifiers[index]!
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        if (modifiers.includes((SemanticTokenModifiers as any)[key])) bitflag += 1 << index
    }
    return bitflag
}

enum SemanticTokenTypes {
    function,
    variable,
}

enum SemanticTokenModifiers {
    mutable,
    underline,
}
const tokenModifiers = Object.keys(SemanticTokenModifiers).filter((x) => !x.match(/\d/))
