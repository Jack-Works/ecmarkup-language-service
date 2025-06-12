import type { Connection, Location, ServerCapabilities, TextDocuments } from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { getSourceFile } from '../utils/parse.js'
import { expandWord } from '../utils/text.js'
import { createRange } from '../utils/utils.js'

export function referenceProvider(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['referencesProvider']> {
    connection.onReferences(async (params, token, workDoneProgress, resultProgress) => {
        const document = documents.get(params.textDocument.uri)
        if (!document) return undefined
        const sourceFile = getSourceFile.get(document)

        const offset = document.offsetAt(params.position)
        const { word, isGrammarLeading, isVariableLeading } = expandWord(document.getText(), offset)

        const node = sourceFile.findNodeAt(offset)
        if (node.tag === 'emu-grammar' || isGrammarLeading) {
            const result = sourceFile.grammars.filter((x) => x.name === word)
            return result.map((ref): Location => ({ uri: document.uri, range: sourceFile.getEntryRange(ref) }))
        } else if (node.tag === 'emu-alg') {
            // TODO: variable
            const operation = sourceFile.localDefinedAbstractOperations.find((x) => x.name === word)
            if (operation) {
                const text = document.getText()
                const location: Location[] = []
                let lastIndex = 0
                while (true) {
                    lastIndex = text.indexOf(word, lastIndex + 1)
                    if (lastIndex === -1) break
                    if (!text.slice(lastIndex - 1, lastIndex).match(/.\b\w/)) continue
                    location.push({
                        uri: document.uri,
                        range: createRange(
                            sourceFile.text.positionAt(lastIndex),
                            sourceFile.text.positionAt(lastIndex + word.length),
                        ),
                    })
                }
                return location
            }
        }

        return undefined
    })
    return {}
}
