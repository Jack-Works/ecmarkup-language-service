import { TextDocuments, type InitializeResult, type Connection, TextDocumentSyncKind } from 'vscode-languageserver'
import { SourceFile } from './utils/document.js'
import { completionProvider } from './features/completion.js'

const documents: TextDocuments<SourceFile> = new TextDocuments(SourceFile)
export function initialize(connection: Connection) {
    connection.onInitialize((params) => {
        const features: InitializeResult<any> = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                completionProvider: completionProvider(connection, documents)!,
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
