import {
    type CancellationToken,
    type Connection,
    type Definition,
    type DefinitionLink,
    type DefinitionParams,
    type HandlerResult,
    type Location,
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
): NonNullable<ServerCapabilities['definitionProvider']> {
    const goToDefinition = new GoToDefinition()
    connection.onDefinition(goToDefinition.handler(documents, program))
    return {}
}

export class GoToDefinition {
    onDefinition(
        document: TextDocument,
        program: Program,
        params: DefinitionParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Definition | DefinitionLink[] | undefined | null {
        const sourceFile = program.getSourceFile(document)
        const offset = document.offsetAt(params.position)
        const { word, isGrammarLeading, isVariableLeading } = word_at_cursor(document.getText(), offset)

        const node = sourceFile.findNodeAt(offset)
        if (node.tag === 'emu-grammar' || isGrammarLeading) {
            const result = sourceFile.localDefinedGrammars.filter((define) => define.name === word)
            return result.map((define): Location => ({ uri: document.uri, range: sourceFile.getEntryRange(define) }))
        } else if (node.tag === 'emu-alg' || node.tag === 'h1') {
            if (isVariableLeading) {
                const header = sourceFile.getAlgHeader(offset)
                const headerText = sourceFile.getNodeText(header)
                const headerDefine = headerText?.indexOf(`_${word}_`)
                if (header && headerDefine && headerDefine !== -1) {
                    const headerStart = header.startTagEnd || header.start
                    return {
                        uri: document.uri,
                        range: Range.create(
                            sourceFile.text.positionAt(headerStart + headerDefine + 1),
                            sourceFile.text.positionAt(
                                (header.startTagEnd || header.start) + headerDefine + word.length + 1,
                            ),
                        ),
                    }
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
                return {
                    uri: document.uri,
                    range: Range.create(
                        sourceFile.text.positionAt((node.startTagEnd || node.start) + nodeDefine + 5),
                        sourceFile.text.positionAt((node.startTagEnd || node.start) + nodeDefine + word.length + 5),
                    ),
                }
            } else {
                const operation = sourceFile.localDefinedAbstractOperations.find((entry) => entry.name === word)
                if (operation) return { uri: document.uri, range: sourceFile.getEntryRange(operation) }
            }
        }

        return undefined
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
