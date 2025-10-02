import {
    type CancellationToken,
    type Connection,
    type DocumentSymbol,
    type DocumentSymbolClientCapabilities,
    type DocumentSymbolParams,
    Location,
    type ResultProgressReporter,
    type ServerCapabilities,
    type SymbolInformation,
    SymbolKind,
    type TextDocuments,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { formatSpecValueText } from '../utils/format.js'
import type { Program } from '../workspace/program.js'

export function documentSymbolProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
    capabilities: DocumentSymbolClientCapabilities | undefined,
): NonNullable<ServerCapabilities['documentSymbolProvider']> {
    const provider = new DocumentSymbolProvider(capabilities)
    connection.onDocumentSymbol(provider.handler(documents, program))
    return {}
}

export class DocumentSymbolProvider {
    constructor(
        public capabilities: DocumentSymbolClientCapabilities | undefined = { hierarchicalDocumentSymbolSupport: true },
    ) {}

    async findDocumentSymbols(
        document: TextDocument,
        program: Program,
        _params: DocumentSymbolParams,
        _token?: CancellationToken | undefined,
        _workDoneProgress?: WorkDoneProgressReporter | undefined,
        _resultProgress?: ResultProgressReporter<SymbolInformation[] | DocumentSymbol[]> | undefined,
    ): Promise<SymbolInformation[] | DocumentSymbol[] | null | undefined> {
        const sourceFile = program.getSourceFile(document)
        const symbols: DocumentSymbol[] = []
        for (const grammar of sourceFile.localDefinedGrammars) {
            symbols.push({
                name: grammar.name,
                kind: SymbolKind.Interface,
                range: sourceFile.getRelativeRange(grammar.node, grammar.fullDefinitionRange),
                selectionRange: sourceFile.getRelativeRange(grammar.node, grammar.range),
            })
        }
        for (const operation of sourceFile.localDefinedAbstractOperations) {
            const header = sourceFile.getAlgHeader(operation.node.startTagEnd || operation.node.start)
            let detail: string | undefined
            const seenVariables = new Set<string>()
            const children: DocumentSymbol[] = []

            if (header) {
                const position = operation.range.position + operation.range.length
                const headerText = sourceFile.getNodeText(header).slice(position)
                const params = [...headerText.matchAll(/_(\w+)_/g)]
                params.forEach((param) => {
                    if (!seenVariables.has(param[1]!)) {
                        seenVariables.add(param[1]!)
                        const range = sourceFile.getRelativeRange(header, {
                            position: position + param.index + 1,
                            length: param[1]!.length,
                        })
                        children.push({
                            name: param[1]!,
                            kind: SymbolKind.Variable,
                            range,
                            selectionRange: range,
                        })
                    }
                })
                detail = `(${params.map((param) => param[1]).join(', ')})`
                const returnType = headerText.split(':').at(-1)
                if (returnType) detail += `: ${formatSpecValueText(returnType.trim()).trim()}`
            }

            const parent = operation.node.parent
            if (parent) {
                const fullText = sourceFile.getNodeText(parent)
                for (const match of fullText.matchAll(/let\s*_(\w+)_/dgi)) {
                    if (!seenVariables.has(match[1]!)) {
                        seenVariables.add(match[1]!)
                        const range = sourceFile.getRelativeRange(parent, {
                            position: match.indices![1]![0],
                            length: match[1]!.length,
                        })
                        children.push({
                            name: match[1]!,
                            kind: SymbolKind.Variable,
                            range,
                            selectionRange: range,
                        })
                    }
                }
            }

            symbols.push({
                name: operation.name,
                kind: SymbolKind.Function,
                range: sourceFile.getRelativeRange(operation.node, operation.fullDefinitionRange),
                selectionRange: sourceFile.getRelativeRange(operation.node, operation.range),
                detail,
                children,
            })
        }
        return this.toClient(document.uri, symbols)
    }

    private toClient(uri: string, result: SymbolInformation[] | DocumentSymbol[]) {
        if (this.capabilities?.hierarchicalDocumentSymbolSupport) {
            return result
        } else {
            return (result as DocumentSymbol[]).flatMap((symbol): SymbolInformation => {
                return {
                    kind: symbol.kind,
                    location: Location.create(uri, symbol.selectionRange),
                    name: symbol.name,
                }
            })
        }
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: DocumentSymbolParams,
            token: CancellationToken,
            workDoneProgress: WorkDoneProgressReporter,
            resultProgress: ResultProgressReporter<SymbolInformation[] | DocumentSymbol[]> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return this.findDocumentSymbols(document, program, params, token, workDoneProgress, resultProgress)
        }
    }
}
