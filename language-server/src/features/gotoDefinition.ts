import {
    type CancellationToken,
    type Connection,
    type Definition,
    type DefinitionClientCapabilities,
    type DefinitionLink,
    type DefinitionParams,
    type HandlerResult,
    type Location,
    type LocationLink,
    Range,
    type ServerCapabilities,
    type TextDocuments,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { word_at_cursor } from '../utils/text.js'
import type { Program } from '../workspace/program.js'

export function definitionProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
    capabilities: DefinitionClientCapabilities | undefined,
): NonNullable<ServerCapabilities['definitionProvider']> {
    const goToDefinition = new GoToDefinition(capabilities)
    connection.onDefinition(goToDefinition.handler(documents, program))
    return {}
}

export class GoToDefinition {
    constructor(public capabilities?: DefinitionClientCapabilities) {}

    onDefinition(
        document: TextDocument,
        program: Program,
        params: DefinitionParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Definition | DefinitionLink[] | undefined | null {
        const sourceFile = program.getSourceFile(document)
        const offset = document.offsetAt(params.position)
        const { word, isGrammarLeading, isVariableLeading, leftBoundary, rightBoundary } = word_at_cursor(
            document.getText(),
            offset,
        )
        const originSelectionRange = Range.create(
            sourceFile.text.positionAt(leftBoundary),
            sourceFile.text.positionAt(rightBoundary),
        )

        const node = sourceFile.findNodeAt(offset)
        if (node.tag === 'emu-grammar' || isGrammarLeading) {
            const result = sourceFile.localDefinedGrammars.filter((define) => define.name === word)
            return this.toClient(
                result.map(
                    (define): LocationLink => ({
                        targetUri: document.uri,
                        targetRange: sourceFile.getRelativeRange(define.node, define.fullDefinitionRange),
                        targetSelectionRange: sourceFile.getRelativeRange(define.node, define.range),
                        originSelectionRange,
                    }),
                ),
            )
        } else if (node.tag === 'emu-alg' || node.tag === 'h1') {
            if (isVariableLeading) {
                const header = sourceFile.getAlgHeader(offset)
                const headerText = sourceFile.getNodeText(header)
                const headerDefine = headerText?.indexOf(`_${word}_`)
                if (header && headerDefine && headerDefine !== -1) {
                    const targetSelectionRange = sourceFile.getRelativeRange(header, {
                        position: headerDefine + 1,
                        length: word.length,
                    })
                    return this.toClient([
                        {
                            targetUri: document.uri,
                            targetRange: targetSelectionRange,
                            targetSelectionRange,
                            originSelectionRange,
                        },
                    ])
                }

                const nodeText = sourceFile.getNodeText(node)
                let nodeDefine = nodeText.indexOf(`Let _${word}_`)
                if (nodeDefine === -1) {
                    try {
                        const match = nodeText.match(new RegExp(`For each (\\w+) _${word}_ of `))
                        if (match) nodeDefine = match.index! + match[1]!.length + 6
                    } catch {}
                }
                if (nodeDefine === -1) return undefined
                const targetSelectionRange = sourceFile.getRelativeRange(node, {
                    position: nodeDefine + 5,
                    length: word.length,
                })
                return this.toClient([
                    {
                        targetUri: document.uri,
                        targetRange: targetSelectionRange,
                        targetSelectionRange,
                        originSelectionRange,
                    },
                ])
            } else {
                const operation = sourceFile.localDefinedAbstractOperations.find((entry) => entry.name === word)
                if (operation) {
                    return this.toClient([
                        {
                            targetUri: document.uri,
                            targetSelectionRange: sourceFile.getRelativeRange(operation.node, operation.range),
                            targetRange: sourceFile.getRelativeRange(operation.node, operation.fullDefinitionRange),
                            originSelectionRange,
                        },
                    ])
                }
            }
        }

        return undefined
    }

    private toClient(location: LocationLink[]): LocationLink[] | Location[] | Location {
        if (this.capabilities?.linkSupport) return location
        return location.map((link): Location => ({ uri: link.targetUri, range: link.targetSelectionRange }))
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: DefinitionParams,
            _token?: CancellationToken,
            _workDoneProgress?: WorkDoneProgressReporter,
        ): HandlerResult<Definition | DefinitionLink[] | undefined | null, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.onDefinition(document, program, params, _token, _workDoneProgress)
        }
    }
}
