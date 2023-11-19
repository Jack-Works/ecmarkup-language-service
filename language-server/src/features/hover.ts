import { type Connection, type TextDocuments, type ServerCapabilities } from 'vscode-languageserver'
import type { SourceFile } from '../utils/document.js'
import { biblio, getText } from '../utils/biblio.js'
import { findWholeWord } from '../utils/text.js'
import { formatDocument } from '../utils/format.js'

export function hoverProvider(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
): ServerCapabilities['hoverProvider'] {
    connection.onHover(async (params, token, workDoneProgress, resultProgress) => {
        const file = documents.get(params.textDocument.uri)
        if (!file) return undefined

        const fullText = file.text.getText()
        const offset = file.text.offsetAt(params.position)
        let [before, after, all] = findWholeWord(fullText, offset)
        if (all.startsWith('|') && all.endsWith('|')) all = all.slice(1, -1)

        const item = biblio.entries.find((f) => all === getText(f))
        if (!item) return
        const contents = formatDocument(item)
        if (!contents) return undefined
        return { contents }
    })
    return {}
}
