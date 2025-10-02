import type {
    CancellationToken,
    Connection,
    Location,
    ReferenceParams,
    ResultProgressReporter,
    ServerCapabilities,
    TextDocuments,
    WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getFirstElementChild } from '../parser/html.js'
import { word_at_cursor } from '../parser/text.js'
import type { Program } from '../workspace/program.js'

export function referenceProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['referencesProvider']> {
    const provider = new ReferenceProvider()
    connection.onReferences(provider.handler(documents, program))
    return {}
}

export class ReferenceProvider {
    findReferences(
        document: TextDocument,
        program: Program,
        params: ReferenceParams,
        _token?: CancellationToken | undefined,
        _workDoneProgress?: WorkDoneProgressReporter | undefined,
        _resultProgress?: ResultProgressReporter<Location[]> | undefined,
    ) {
        const sourceFile = program.getSourceFile(document)
        const offset = document.offsetAt(params.position)
        const { word, isGrammarLeading, isVariable } = word_at_cursor(document.getText(), offset)
        const { includeDeclaration } = params.context

        const node = sourceFile.findElementAt(offset)
        if (node?.nodeName === 'emu-grammar' || isGrammarLeading) {
            const result = sourceFile.grammars.filter(
                (entry) => entry.name === word && (includeDeclaration || entry.type === 'reference'),
            )
            return result.map(
                (ref): Location => ({ uri: document.uri, range: sourceFile.getRelativeRange(ref.node, ref.range) }),
            )
        } else if (node?.nodeName === 'h1' || node?.nodeName === 'emu-alg') {
            if (isVariable) {
                const searchingNode = getFirstElementChild(
                    sourceFile.getAbstractOperationHeader(offset)?.parentNode ?? node,
                )
                const text = sourceFile.getNodeInnerText(searchingNode)
                const location: Location[] = []
                let lastIndex = 0
                while (text && searchingNode) {
                    lastIndex = text.indexOf(`_${word}_`, lastIndex + 1)
                    if (lastIndex === -1) break
                    location.push({
                        uri: document.uri,
                        range: sourceFile.getRelativeRangeToInnerText(searchingNode, lastIndex + 1, word.length),
                    })
                }
                return location
            } else {
                return sourceFile
                    .findReferencesOfLocalAbstractOperation(word)
                    ?.map((range): Location => ({ uri: document.uri, range }))
            }
        }

        return undefined
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: ReferenceParams,
            token: CancellationToken,
            workDoneProgress: WorkDoneProgressReporter,
            resultProgress: ResultProgressReporter<Location[]> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return this.findReferences(document, program, params, token, workDoneProgress, resultProgress)
        }
    }
}
