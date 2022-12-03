import type { Connection, TextDocuments, PublishDiagnosticsClientCapabilities } from 'vscode-languageserver'
import type { SourceFile as SourceFile } from '../utils/document.js'

export function enablePushDiagnostics(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
    cap: PublishDiagnosticsClientCapabilities | undefined
): void {
    if (!cap) return
    documents.onDidChangeContent(async (change) => {
        const doc = change.document
        connection.sendDiagnostics({
            diagnostics: await doc.build(),
            uri: doc.uri,
            version: doc.text.version,
        })
    })
}
