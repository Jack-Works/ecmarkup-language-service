import type {
    CancellationToken,
    Connection,
    DocumentLink,
    DocumentLinkParams,
    Location,
    ResultProgressReporter,
    ServerCapabilities,
    WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { documents } from '../server-shared.js'
import { getText, getURL } from '../utils/biblio.js'
import type { Program } from '../workspace/program.js'

export class DocumentLinks {
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

    static enable(
        serverCapabilities: ServerCapabilities<never>,
        connection: Connection,
        program: Program,
        _capabilities: unknown,
    ) {
        const provider = new DocumentLinks()
        connection.onDocumentLinks((params, token, workDoneProgress, resultProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return provider.findDocumentLinks(document, program, params, token, workDoneProgress, resultProgress)
        })
        serverCapabilities.documentLinkProvider = {}
    }
}
