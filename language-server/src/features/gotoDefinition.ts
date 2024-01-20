import { type Connection, type TextDocuments, type ServerCapabilities, Location } from 'vscode-languageserver'
import { TextDocument } from '../lib.js'
import { getSourceFile } from '../utils/parse.js'
import { expandWord } from '../utils/text.js'
import { createRange } from '../utils/utils.js'

export function definitionProvider(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['definitionProvider']> {
    connection.onDefinition(async (params, token, workDoneProgress, resultProgress) => {
        const document = documents.get(params.textDocument.uri)
        if (!document) return undefined
        const sourceFile = getSourceFile.get(document)

        const offset = document.offsetAt(params.position)
        let { word, isGrammarLeading, isVariableLeading } = expandWord(document.getText(), offset)

        const node = sourceFile.findNodeAt(offset)
        if (node.tag === 'emu-grammar' || isGrammarLeading) {
            const result = sourceFile.getGrammarDefinition(word)
            return result.map((range): Location => ({ uri: document.uri, range: range[1] }))
        } else if (node.tag === 'emu-alg') {
            if (isVariableLeading) {
                const header = sourceFile.getAlgHeader(offset)
                const headerText = sourceFile.getNodeText(header)
                const headerDefine = headerText?.indexOf(`_${word}_`)
                if (header && headerDefine && headerDefine !== -1) {
                    const headerStart = header.startTagEnd || header.start
                    return {
                        uri: document.uri,
                        range: createRange(
                            sourceFile.text.positionAt(headerStart + headerDefine),
                            sourceFile.text.positionAt(
                                (header.startTagEnd || header.start) + headerDefine + word.length + 2,
                            ),
                        ),
                    }
                }

                const nodeText = sourceFile.getNodeText(node)
                let nodeDefine = nodeText.indexOf(`Let _${word}_`)
                if (nodeDefine === -1) {
                    try {
                        const match = nodeText.match(new RegExp(`For each (\\w+) _${word}_ of `))
                        if (match) nodeDefine = match.index! + match[1]!.length + 6
                    } catch {}
                }
                if (nodeDefine === -1) return undefined
                return {
                    uri: document.uri,
                    range: createRange(
                        sourceFile.text.positionAt((node.startTagEnd || node.start) + nodeDefine + 4),
                        sourceFile.text.positionAt((node.startTagEnd || node.start) + nodeDefine + word.length + 6),
                    ),
                }
            }
        }

        return undefined
    })
    return {}
}
