import type { Element } from 'parse5'
import { isElementNode } from 'parse5/lib/tree-adapters/default.js'
import type {
    Connection,
    SemanticTokens,
    SemanticTokensParams,
    SemanticTokensRangeParams,
    ServerCapabilities,
    TextDocuments,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getAbstractOperationHeader } from '../parser/ecmarkup.js'
import { isBiblioOp } from '../utils/biblio.js'
import type { Program } from '../workspace/program.js'

export function semanticTokensProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['semanticTokensProvider']> {
    const semanticTokens = new SemanticToken()
    connection.languages.semanticTokens.on(semanticTokens.handler(documents, program))
    connection.languages.semanticTokens.onRange(semanticTokens.handler(documents, program))

    return {
        full: { delta: false },
        range: true,
        legend: {
            tokenTypes: Object.keys(SemanticTokenTypes).filter((token) => !token.match(/\d/)),
            tokenModifiers,
        },
    }
}

export interface SemanticTokenData {
    offset: number
    length: number
    tokenType: SemanticTokenTypes
    modifier: SemanticTokenModifiers[]
}

export class SemanticToken {
    async tokenizeCompressed(
        document: TextDocument,
        program: Program,
        params: SemanticTokensParams | SemanticTokensRangeParams,
    ): Promise<SemanticTokens> {
        const data = (await this.tokenize(document, program, params)).sort((a, b) => a.offset - b.offset)
        const compressed: number[] = []
        let lastLine = 0
        let lastChar = 0
        for (const { offset, length, tokenType, modifier } of data) {
            const { line, character } = document.positionAt(offset)
            if (compressed.length === 0) {
                compressed.push(line, character, length, tokenType, modifierToArray(modifier))
            } else {
                compressed.push(
                    line - lastLine,
                    line === lastLine ? character - lastChar : character,
                    length,
                    tokenType,
                    modifierToArray(modifier),
                )
            }
            lastLine = line
            lastChar = character
        }
        return { data: compressed }
    }

    async tokenize(
        document: TextDocument,
        program: Program,
        params: SemanticTokensParams | SemanticTokensRangeParams,
    ): Promise<SemanticTokenData[]> {
        const biblio = await program.resolveBiblio(document.uri)
        const sourceFile = program.getSourceFile(document)
        const tokens: SemanticTokenData[] = []

        function visitor(node: Element) {
            if ('range' in params) {
                const range_from = document.offsetAt(params.range.start)
                const range_to = document.offsetAt(params.range.end)
                const node_from = node.sourceCodeLocation?.startOffset
                const node_to = node.sourceCodeLocation?.endOffset
                if (node_from !== undefined && range_from < node_from) {
                    if (node_to !== undefined && range_to > node_to) return
                }
            }
            if (node.nodeName === 'emu-alg') {
                for (const { index, 1: word } of (sourceFile.getNodeInnerText(node) || '').matchAll(
                    /(?<word>\b\w+\b)(?:\(| of)/g,
                )) {
                    if (
                        biblio
                            .filter(isBiblioOp)
                            .find((entry) => entry.aoid === word)
                            ?.effects.includes('user-code')
                    ) {
                        tokens.push({
                            offset: node.sourceCodeLocation!.startTag.endOffset + index,
                            length: word!.length,
                            tokenType: SemanticTokenTypes.function,
                            modifier: [SemanticTokenModifiers.mutable],
                        })
                    } else {
                        const local = sourceFile.localDefinedAbstractOperations.find((op) => op.name === word)
                        if (local) {
                            tokens.push({
                                offset: node.sourceCodeLocation!.startTag.endOffset + index,
                                length: word!.length,
                                tokenType: SemanticTokenTypes.function,
                                modifier: [],
                            })
                        }
                    }
                }
            } else if (node.nodeName === 'h1') {
                if (getAbstractOperationHeader(node)) {
                    const innerText = sourceFile.getNodeInnerText(node)
                    const aoid = innerText?.match(
                        /(?<semantics>(?:Static Semantics:|Runtime Semantics:))?\s*(?<aoid>[\w.[\]% ]+)\s*\(/du,
                    )
                    if (aoid && innerText) {
                        if (aoid.groups!['semantics']) {
                            tokens.push({
                                offset: node.sourceCodeLocation!.startTag.endOffset + aoid.indices![1]![0],
                                length: aoid.groups!['semantics']!.length - 1,
                                tokenType: SemanticTokenTypes.comment,
                                modifier: [],
                            })
                        }
                        tokens.push({
                            offset: node.sourceCodeLocation!.startTag.endOffset + aoid.indices![2]![0],
                            length: aoid.groups!['aoid']!.length - 1,
                            tokenType: SemanticTokenTypes.function,
                            modifier: [],
                        })
                        const matcher = /\[?\s*_(?<variable>\w+)_\s*\]?\s*(:\s*(?<type>.*)\]?\s*,)?/dg
                        matcher.lastIndex = aoid.index!
                        for (const parameter of innerText.matchAll(matcher)) {
                            tokens.push({
                                offset: node.sourceCodeLocation!.startTag.endOffset + parameter.indices![1]![0],
                                length: parameter.groups!['variable']!.length,
                                tokenType: SemanticTokenTypes.variable,
                                modifier: [],
                            })
                            const type = parameter.indices![3]?.[0]
                            type &&
                                tokens.push({
                                    offset: node.sourceCodeLocation!.startTag.endOffset + type,
                                    length: parameter.groups!['type']!.length,
                                    tokenType: SemanticTokenTypes.type,
                                    modifier: [],
                                })
                        }
                        const typeMatcher = /\): (?<type>.+)/dg
                        typeMatcher.lastIndex = matcher.lastIndex
                        const returnType = typeMatcher.exec(innerText)
                        if (returnType) {
                            tokens.push({
                                offset: node.sourceCodeLocation!.startTag.endOffset + returnType.indices![1]![0],
                                length: returnType.groups!['type']!.length,
                                tokenType: SemanticTokenTypes.type,
                                modifier: [],
                            })
                        }
                    }
                }
            } else if ('childNodes' in node) node.childNodes.filter(isElementNode).forEach(visitor)
        }
        sourceFile.html.childNodes.filter(isElementNode).forEach(visitor)
        return tokens
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (params: SemanticTokensParams | SemanticTokensRangeParams) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return { data: [] }
            return this.tokenizeCompressed(document, program, params)
        }
    }
}

function modifierToArray(modifiers: readonly SemanticTokenModifiers[]) {
    let bitflag = 0
    for (let index = 0; index < tokenModifiers.length; index++) {
        const key = tokenModifiers[index]!
        // biome-ignore lint/suspicious/noExplicitAny: use enum as bit map
        if (modifiers.includes((SemanticTokenModifiers as any)[key])) bitflag += 1 << index
    }
    return bitflag
}

export enum SemanticTokenTypes {
    function,
    variable,
    comment,
    type,
}

export enum SemanticTokenModifiers {
    mutable,
    underline,
}

const tokenModifiers = Object.keys(SemanticTokenModifiers).filter((x) => !x.match(/\d/))
