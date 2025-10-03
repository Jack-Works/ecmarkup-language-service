import {
    type CancellationToken,
    type Connection,
    DocumentHighlightKind,
    type DocumentHighlightParams,
    type Location,
    type ResultProgressReporter,
    type ServerCapabilities,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { documents } from '../server-shared.js'
import type { Program } from '../workspace/program.js'
import { Reference } from './findAllReferences.js'

export class DocumentHighlight {
    findDocumentHighlights(
        document: TextDocument,
        program: Program,
        params: DocumentHighlightParams,
        token?: CancellationToken | undefined,
        workDoneProgress?: WorkDoneProgressReporter | undefined,
        resultProgress?: ResultProgressReporter<Location[]> | undefined,
    ) {
        const { position, textDocument, partialResultToken, workDoneToken } = params
        const ref = new Reference()
        return ref
            .findReferences(
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
            ?.map((loc) => {
                const start = document.offsetAt(loc.range.start)
                return {
                    range: loc.range,
                    kind: document
                        .getText()
                        .slice(start - 5, start)
                        .match(/let _|set _/i)
                        ? DocumentHighlightKind.Write
                        : DocumentHighlightKind.Text,
                }
            })
    }

    static enable(
        serverCapabilities: ServerCapabilities<never>,
        connection: Connection,
        program: Program,
        _capabilities: unknown,
    ) {
        const provider = new DocumentHighlight()
        connection.onDocumentHighlight((params, token, workDoneProgress, resultProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return provider.findDocumentHighlights(document, program, params, token, workDoneProgress, resultProgress)
        })
        serverCapabilities.documentHighlightProvider = {}
    }
}
