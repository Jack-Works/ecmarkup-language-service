import { type Connection, MarkupKind, type ServerCapabilities, type TextDocuments } from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { getText, resolve_biblio } from '../utils/biblio.js'
import { formatDocument } from '../utils/format.js'
import { getSourceFile } from '../utils/parse.js'
import { expandWord } from '../utils/text.js'

export function hoverProvider(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['hoverProvider']> {
    connection.onHover(async (params, _token, _workDoneProgress, _resultProgress) => {
        const document = documents.get(params.textDocument.uri)
        if (!document) return undefined
        const resolved_biblio = await resolve_biblio(connection, params.textDocument.uri)

        const fullText = document.getText()
        const offset = document.offsetAt(params.position)
        const sourceFile = getSourceFile.get(document)

        const { word, isGrammar } = expandWord(fullText, offset)

        const entry = resolved_biblio.entries.find((entry) => {
            if (isGrammar) return entry.type === 'production' && word === entry.name
            return word === getText(entry)
        })
        if (entry) {
            const contents = formatDocument(entry)
            if (!contents) return undefined
            return { contents }
        }

        const local = sourceFile.getGrammarDefinition(word)
        if (local[0]) {
            return { contents: { kind: MarkupKind.PlainText, language: 'grammarkdown', value: local[0][0].summary } }
        }
        return undefined
    })
    return {}
}
