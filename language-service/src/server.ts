import { createConnection, TextDocuments, ProposedFeatures, type InitializeResult } from 'vscode-languageserver/node.js'
import { SourceFile } from './utils/document.js'
import { formatProvider } from './features/formatter.js'
import { enablePushDiagnostics } from './features/diagnostics.js'
import { semanticTokensProvider } from './features/highlight.js'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<SourceFile> = new TextDocuments(SourceFile)

connection.onInitialize((params) => {
    const { textDocument } = params.capabilities

    enablePushDiagnostics(connection, documents, textDocument?.publishDiagnostics)

    const features: InitializeResult<any> = {
        capabilities: {
            documentFormattingProvider: formatProvider(connection, documents, textDocument?.formatting)!,
            semanticTokensProvider: semanticTokensProvider(connection, documents, textDocument?.semanticTokens)!,
        },
        serverInfo: {
            name: 'ECMarkup Language Server',
            version: '0.0.1',
        },
    }
    return features
})

documents.listen(connection)
connection.listen()
