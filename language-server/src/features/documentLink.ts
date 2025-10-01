import type {
    CancellationToken,
    Connection,
    DocumentLink,
    DocumentLinkParams,
    Location,
    ResultProgressReporter,
    ServerCapabilities,
    TextDocuments,
    WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { getText, getURL } from '../utils/biblio.js'
import type { Program } from '../workspace/program.js'

export function documentLinkProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['documentLinkProvider']> {
    const provider = new DocumentLinkProvider()
    connection.onDocumentLinks(provider.handler(documents, program))
    return {}
}

export class DocumentLinkProvider {
    async findDocumentLinks(
        document: TextDocument,
        program: Program,
        _params: DocumentLinkParams,
        _token?: CancellationToken | undefined,
        _workDoneProgress?: WorkDoneProgressReporter | undefined,
        _resultProgress?: ResultProgressReporter<Location[]> | undefined,
    ) {
        const biblio = await program.resolveBiblio(document.uri)
        const text = document.getText()

        const has = new Set<string>(
            biblio.map((entry) => (entry.type === 'op' || entry.type === 'production' ? getText(entry)! : undefined!)),
        )
        has.delete(undefined!)

        const result: DocumentLink[] = []
        for (const regex of text.matchAll(/\b(\w+)\b/gu)) {
            if (regex[1] && has.has(regex[1])) {
                const start = document.positionAt(regex.index!)
                const end = document.positionAt(regex.index! + regex[1].length)
                const location: Location = {
                    range: { start, end },
                    uri: document.uri + `#${regex[1]}`,
                }
                result.push({
                    range: location.range,
                    target: getURL(biblio.find((entry) => getText(entry) === regex[1])!),
                })
            }
        }
        return result
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: DocumentLinkParams,
            token: CancellationToken,
            workDoneProgress: WorkDoneProgressReporter,
            resultProgress: ResultProgressReporter<Location[]> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return this.findDocumentLinks(document, program, params, token, workDoneProgress, resultProgress)
        }
    }
}
