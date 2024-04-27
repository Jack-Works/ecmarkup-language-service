import { type Connection, type InitializeResult, TextDocumentSyncKind, TextDocuments } from 'vscode-languageserver'
import { completionProvider } from './features/completion.js'
import { definitionProvider } from './features/gotoDefinition.js'
import { hoverProvider } from './features/hover.js'
import { TextDocument } from './lib.js'
import { getSourceFile } from './utils/parse.js'

const documents = new TextDocuments(TextDocument)
// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_implementation
export function initialize(connection: Connection) {
    connection.onInitialize((params) => {
        const features: InitializeResult<never> = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,

                completionProvider: completionProvider(connection, documents),
                definitionProvider: definitionProvider(connection, documents),
                hoverProvider: hoverProvider(connection, documents),

                // callHierarchyProvider,
                // codeActionProvider,
                // codeLensProvider,
                // colorProvider,
                // declarationProvider,
                // diagnosticProvider,
                // documentFormattingProvider,
                // documentHighlightProvider,
                // documentLinkProvider,
                // documentOnTypeFormattingProvider,
                // documentRangeFormattingProvider,
                // documentSymbolProvider,
                // executeCommandProvider,
                // foldingRangeProvider,
                // implementationProvider,
                // inlayHintProvider,
                // inlineCompletionProvider,
                // inlineValueProvider,
                // linkedEditingRangeProvider,
            },
            serverInfo: {
                name: 'ecmarkup language server',
                version: '0.2.0',
            },
        }
        return features
    })
    documents.onDidClose((e) => getSourceFile.onDocumentRemoved(e.document))
    connection.onShutdown(() => getSourceFile.dispose())

    documents.listen(connection)
    connection.listen()
}
