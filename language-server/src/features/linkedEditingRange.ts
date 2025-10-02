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
import type { TextDocument } from '../lib.js'
import type { Program } from '../workspace/program.js'
import { ReferenceProvider } from './findAllReferences.js'

export function linkedEditingRangeProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['linkedEditingRangeProvider']> {
    const provider = new LinkedEditingRangeProvider()
    connection.languages.onLinkedEditingRange(provider.handler(documents, program))
    return {}
}

export class LinkedEditingRangeProvider {
    findLinkedEditingRanges(
        document: TextDocument,
        program: Program,
        params: LinkedEditingRangeParams,
        token?: CancellationToken | undefined,
        workDoneProgress?: WorkDoneProgressReporter | undefined,
        _resultProgress?: ResultProgressReporter<LinkedEditingRanges> | undefined,
    ): LinkedEditingRanges | null | undefined {
        const references = new ReferenceProvider().findReferences(
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

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: LinkedEditingRangeParams,
            token: CancellationToken,
            workDoneProgress: WorkDoneProgressReporter,
            resultProgress: ResultProgressReporter<LinkedEditingRanges> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return this.findLinkedEditingRanges(document, program, params, token, workDoneProgress, resultProgress)
        }
    }
}
