import { type Connection, type InitializeResult, TextDocumentSyncKind, TextDocuments } from 'vscode-languageserver'
import { completionProvider } from './features/completion.js'
import { definitionProvider } from './features/gotoDefinition.js'
import { hoverProvider } from './features/hover.js'
import { TextDocument } from './lib.js'
import { getSourceFile } from './utils/parse.js'
import { semanticTokensProvider } from './features/semanticTokens.js'
import { referenceProvider } from './features/findAllReferences.js'

const documents = new TextDocuments(TextDocument)
// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_implementation
export function initialize(connection: Connection, version: string) {
    connection.onInitialize((params) => {
        const features: InitializeResult<never> = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,

                completionProvider: completionProvider(connection, documents),
                definitionProvider: definitionProvider(connection, documents),
                hoverProvider: hoverProvider(connection, documents),
                semanticTokensProvider: semanticTokensProvider(connection, documents),
                referencesProvider: referenceProvider(connection, documents),
            },
            serverInfo: {
                name: 'ecmarkup language server',
                version,
            },
        }
        return features
    })
    documents.onDidClose((e) => getSourceFile.onDocumentRemoved(e.document))
    connection.onShutdown(() => getSourceFile.dispose())

    documents.listen(connection)
    connection.listen()
}
