import {
    type CancellationToken,
    type Connection,
    type Location,
    Range,
    type ReferenceParams,
    type ResultProgressReporter,
    type ServerCapabilities,
    type TextDocuments,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { word_at_cursor } from '../utils/text.js'
import type { Program } from '../workspace/program.js'

export function referenceProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['referencesProvider']> {
    const provider = new ReferenceProvider()
    connection.onReferences(provider.handler(documents, program))
    return {}
}

export class ReferenceProvider {
    findReferences(
        document: TextDocument,
        program: Program,
        params: ReferenceParams,
        _token?: CancellationToken | undefined,
        _workDoneProgress?: WorkDoneProgressReporter | undefined,
        _resultProgress?: ResultProgressReporter<Location[]> | undefined,
    ) {
        const sourceFile = program.getSourceFile(document)
        const offset = document.offsetAt(params.position)
        const { word, isGrammarLeading, isVariable } = word_at_cursor(document.getText(), offset)
        const { includeDeclaration } = params.context

        const node = sourceFile.findNodeAt(offset)
        if (node.tag === 'emu-grammar' || isGrammarLeading) {
            const result = sourceFile.grammars.filter(
                (entry) => entry.name === word && (includeDeclaration || entry.type === 'reference'),
            )
            return result.map(
                (ref): Location => ({ uri: document.uri, range: sourceFile.getRelativeRange(ref.node, ref.range) }),
            )
        } else if (node.tag === 'h1' || node.tag === 'emu-alg') {
            if (isVariable) {
                const searchingNode = sourceFile.getAlgHeader(offset)?.parent ?? node
                const text = sourceFile.getNodeText(searchingNode)
                const location: Location[] = []
                let lastIndex = 0
                while (true) {
                    lastIndex = text.indexOf(`_${word}_`, lastIndex + 1)
                    if (lastIndex === -1) break
                    location.push({
                        uri: document.uri,
                        range: sourceFile.getRelativeRange(searchingNode, {
                            position: lastIndex + 1,
                            length: word.length,
                        }),
                    })
                }
                return location
            } else {
                const operation = sourceFile.localDefinedAbstractOperations.find((entry) => entry.name === word)
                if (operation) {
                    const text = document.getText()
                    const location: Location[] = []
                    const re =
                        'escape' in RegExp
                            ? new RegExp(
                                  `\\b${
                                      // biome-ignore lint/suspicious/noExplicitAny: remove after Node 24
                                      (RegExp.escape as any)(word)
                                  }\\b`,
                                  'gu',
                              )
                            : // bless us
                              new RegExp(`\\b${word}\\b`, 'g')
                    for (const match of text.matchAll(re)) {
                        location.push({
                            uri: document.uri,
                            range: Range.create(
                                sourceFile.text.positionAt(match.index),
                                sourceFile.text.positionAt(match.index + word.length),
                            ),
                        })
                    }
                    return location
                }
            }
        }

        return undefined
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: ReferenceParams,
            token: CancellationToken,
            workDoneProgress: WorkDoneProgressReporter,
            resultProgress: ResultProgressReporter<Location[]> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return this.findReferences(document, program, params, token, workDoneProgress, resultProgress)
        }
    }
}
