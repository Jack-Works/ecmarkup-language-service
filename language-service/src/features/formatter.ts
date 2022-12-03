import type {
    Connection,
    TextDocuments,
    DocumentFormattingClientCapabilities,
    ServerCapabilities,
} from 'vscode-languageserver'
import type { SourceFile } from '../utils/document.js'
import { printDocument } from '../../ecmarkup/lib/formatter/ecmarkup.js'
import { createPosition, createRange } from '../utils/utils.js'

export function formatProvider(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
    cap: DocumentFormattingClientCapabilities | undefined
): ServerCapabilities['documentFormattingProvider'] {
    if (!cap) return false
    connection.onDocumentFormatting(async (params, token, _workDoneProgress, _resultProgress) => {
        const doc = documents.get(params.textDocument.uri)
        if (!doc) return []

        const text = doc.text.getText()
        const result = await printDocument(text)
        if (token.isCancellationRequested) return []

        return [
            {
                newText: result,
                range: createRange(
                    createPosition.zero,
                    // looks like we don't need to provide the exact end position
                    createPosition(doc.text.lineCount, text.length)
                ),
            },
        ]
    })
    return true
}
