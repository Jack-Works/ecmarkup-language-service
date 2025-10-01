import type {
    CancellationToken,
    Connection,
    DocumentHighlightParams,
    Location,
    ResultProgressReporter,
    ServerCapabilities,
    TextDocuments,
    WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import type { Program } from '../workspace/program.js'
import { ReferenceProvider } from './findAllReferences.js'

export function documentHighlightProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['documentHighlightProvider']> {
    const provider = new DocumentHighlightProvider()
    connection.onDocumentHighlight(provider.handler(documents, program))
    return {}
}

export class DocumentHighlightProvider {
    findDocumentHighlights(
        document: TextDocument,
        program: Program,
        params: DocumentHighlightParams,
        token?: CancellationToken | undefined,
        workDoneProgress?: WorkDoneProgressReporter | undefined,
        resultProgress?: ResultProgressReporter<Location[]> | undefined,
    ) {
        const { position, textDocument, partialResultToken, workDoneToken } = params
        const ref = new ReferenceProvider()
        return ref.findReferences(
            document,
            program,
            {
                position,
                textDocument,
                partialResultToken,
                workDoneToken,
                context: { includeDeclaration: true },
            },
            token,
            workDoneProgress,
            resultProgress,
        )
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: DocumentHighlightParams,
            token: CancellationToken,
            workDoneProgress: WorkDoneProgressReporter,
            resultProgress: ResultProgressReporter<Location[]> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return this.findDocumentHighlights(document, program, params, token, workDoneProgress, resultProgress)
        }
    }
}
