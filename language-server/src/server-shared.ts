import { TextDocuments, type InitializeResult, type Connection, TextDocumentSyncKind } from 'vscode-languageserver'
import { SourceFile } from './utils/document.js'
import { formatProvider } from './features/formatter.js'
import { enablePushDiagnostics } from './features/diagnostics.js'

const documents: TextDocuments<SourceFile> = new TextDocuments(SourceFile)
export function initialize(connection: Connection) {
    connection.onInitialize((params) => {
        const { textDocument } = params.capabilities

        enablePushDiagnostics(connection, documents, textDocument?.publishDiagnostics)

        const features: InitializeResult<any> = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                documentFormattingProvider: formatProvider(connection, documents, textDocument?.formatting)!,
            },
            serverInfo: {
                name: 'ecmarkup language server',
                version: '0.0.1',
            },
        }
        return features
    })
    documents.listen(connection)
    connection.listen()
}
