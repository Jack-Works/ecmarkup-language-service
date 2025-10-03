import { isElementNode } from 'parse5/lib/tree-adapters/default.js'
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
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getAbstractOperationHeader } from '../parser/ecmarkup.js'
import { documents } from '../server-shared.js'
import { formatSpecValueText } from '../utils/format.js'
import type { Program } from '../workspace/program.js'

export class DocumentSymbols {
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
            const header = getAbstractOperationHeader(operation.node)
            const position = operation.range.position + operation.range.length
            const headerText = sourceFile.getNodeInnerText(header)?.slice(position)
            let detail: string | undefined
            const seenVariables = new Set<string>()
            const children: DocumentSymbol[] = []

            if (header && headerText) {
                const params = [...headerText.matchAll(/_(\w+)_/g)]
                params.forEach((param) => {
                    if (!seenVariables.has(param[1]!)) {
                        seenVariables.add(param[1]!)
                        const range = sourceFile.getRelativeRangeToInnerText(
                            header,
                            position + param.index + 1,
                            param[1]!.length,
                        )
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

            const parent = operation.node.parentNode
            const source = sourceFile.getNodeInnerText(parent)
            if (isElementNode(parent) && source) {
                for (const match of source.matchAll(/let\s*_(\w+)_/dgi)) {
                    if (!seenVariables.has(match[1]!)) {
                        seenVariables.add(match[1]!)
                        const range = sourceFile.getRelativeRangeToInnerText(
                            parent,
                            match.indices![1]![0],
                            match[1]!.length,
                        )
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

    static enable(
        serverCapabilities: ServerCapabilities,
        connection: Connection,
        program: Program,
        capabilities: DocumentSymbolClientCapabilities | undefined,
    ) {
        const provider = new DocumentSymbols(capabilities)
        connection.onDocumentSymbol((params, token, workDoneProgress, resultProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return undefined
            return provider.findDocumentSymbols(document, program, params, token, workDoneProgress, resultProgress)
        })
        serverCapabilities.documentSymbolProvider = {}
    }
}
