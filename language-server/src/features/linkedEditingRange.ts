import type {
    CancellationToken,
    Connection,
    LinkedEditingRangeParams,
    LinkedEditingRanges,
    ResultProgressReporter,
    ServerCapabilities,
    TextDocuments,
    WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Program } from '../workspace/program.js'
import { Reference } from './findAllReferences.js'

export class LinkedEditingRange {
    findLinkedEditingRanges(
        document: TextDocument,
        program: Program,
        params: LinkedEditingRangeParams,
        token?: CancellationToken | undefined,
        workDoneProgress?: WorkDoneProgressReporter | undefined,
        _resultProgress?: ResultProgressReporter<LinkedEditingRanges> | undefined,
    ): LinkedEditingRanges | null | undefined {
        const references = new Reference().findReferences(
            document,
            program,
            {
                textDocument: params.textDocument,
                position: params.position,
                context: { includeDeclaration: true },
            },
            token,
            workDoneProgress,
        )
        if (!references) return null
        return { ranges: references.map((ref) => ref.range) }
    }

    static enable(
        capabilities: ServerCapabilities,
        connection: Connection,
        program: Program,
        documents: TextDocuments<TextDocument>,
    ) {
        const provider = new LinkedEditingRange()
        connection.languages.onLinkedEditingRange((params, token, workDoneProgress, resultProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return provider.findLinkedEditingRanges(document, program, params, token, workDoneProgress, resultProgress)
        })
        capabilities.linkedEditingRangeProvider = true
    }
}
