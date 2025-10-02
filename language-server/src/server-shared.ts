import { type Connection, type InitializeResult, TextDocumentSyncKind, TextDocuments } from 'vscode-languageserver'
import { completionProvider } from './features/completion.js'
import { documentHighlightProvider } from './features/documentHighlight.js'
import { documentSymbolProvider } from './features/documentSymbol.js'
import { referenceProvider } from './features/findAllReferences.js'
import { definitionProvider } from './features/gotoDefinition.js'
import { hoverProvider } from './features/hover.js'
import { linkedEditingRangeProvider } from './features/linkedEditingRange.js'
import { renameProvider } from './features/rename.js'
import { semanticTokensProvider } from './features/semanticTokens.js'
import { TextDocument } from './lib.js'
import { createRemoteIO } from './workspace/io.js'
import { createProgram } from './workspace/program.js'

const documents = new TextDocuments(TextDocument)
// https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_implementation
export function initialize(connection: Connection, version: string) {
    const globalProgram = createProgram(createRemoteIO(connection))
    connection.onInitialize((params) => {
        const {
            capabilities: { textDocument: capabilities },
        } = params
        const features: InitializeResult<never> = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                completionProvider: completionProvider(connection, globalProgram, documents, capabilities?.completion),
                definitionProvider: definitionProvider(connection, globalProgram, documents, capabilities?.definition),
                hoverProvider: hoverProvider(connection, globalProgram, documents, capabilities?.hover),
                semanticTokensProvider: semanticTokensProvider(connection, globalProgram, documents),
                referencesProvider: referenceProvider(connection, globalProgram, documents),
                documentHighlightProvider: documentHighlightProvider(connection, globalProgram, documents),
                // It's kinda working for providing links for 262's AOs, but looks strange in IDE, let's skip it for now.
                // documentLinkProvider: documentLinkProvider(connection, globalProgram, documents),
                documentSymbolProvider: documentSymbolProvider(
                    connection,
                    globalProgram,
                    documents,
                    capabilities?.documentSymbol,
                ),
                renameProvider: renameProvider(connection, globalProgram, documents, capabilities?.rename),
                linkedEditingRangeProvider: linkedEditingRangeProvider(connection, globalProgram, documents),
            },
            serverInfo: {
                name: 'ecmarkup language server',
                version,
            },
        }
        return features
    })
    documents.onDidClose((e) => globalProgram.onDocumentRemoved(e.document))
    connection.onShutdown(() => globalProgram.dispose())

    documents.listen(connection)
    connection.listen()
}
