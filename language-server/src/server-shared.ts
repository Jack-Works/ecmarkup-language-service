import { type Connection, type InitializeResult, TextDocumentSyncKind, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Completion } from './features/completion.js'
import { DocumentHighlight } from './features/documentHighlight.js'
import { DocumentSymbols } from './features/documentSymbol.js'
import { Reference } from './features/findAllReferences.js'
import { Formatter } from './features/format.js'
import { GoToDefinition } from './features/gotoDefinition.js'
import { Hovers } from './features/hover.js'
import { Rename } from './features/rename.js'
import { SemanticToken } from './features/semanticTokens.js'
import { createRemoteIO } from './workspace/io.js'
import { createProgram } from './workspace/program.js'

export const documents = new TextDocuments(TextDocument)
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
            },
            serverInfo: {
                name: 'ecmarkup language server',
                version,
            },
        }
        Completion.enable(features.capabilities, connection, globalProgram, capabilities?.completion)
        GoToDefinition.enable(features.capabilities, connection, globalProgram, capabilities?.definition)
        Hovers.enable(features.capabilities, connection, globalProgram, capabilities?.hover)
        SemanticToken.enable(features.capabilities, connection, globalProgram, capabilities?.semanticTokens)
        Reference.enable(features.capabilities, connection, globalProgram, capabilities?.references)
        DocumentHighlight.enable(features.capabilities, connection, globalProgram, capabilities?.documentHighlight)
        // It's kinda working for providing links for 262's AOs, but looks strange in IDE
        // DocumentLink.enable(features.capabilities, connection, globalProgram, capabilities?.documentLink)
        DocumentSymbols.enable(features.capabilities, connection, globalProgram, capabilities?.documentSymbol)
        Rename.enable(features.capabilities, connection, globalProgram, capabilities?.rename)
        // linked editing range behaves strange when using ctrl-x to delete a line
        // LinkedEditingRange.enable(features.capabilities, connection, globalProgram, documents)
        Formatter.enable(features.capabilities, connection, globalProgram, capabilities)
        return features
    })
    documents.onDidClose((e) => globalProgram.onDocumentRemoved(e.document))
    connection.onShutdown(() => globalProgram.dispose())

    documents.listen(connection)
    connection.listen()
}
