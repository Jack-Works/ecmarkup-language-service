import type { BiblioEntry } from '@tc39/ecma262-biblio'
import {
    type CancellationToken,
    type Connection,
    type HandlerResult,
    type PrepareRenameParams,
    Range,
    type RenameClientCapabilities,
    type RenameParams,
    ResponseError,
    type ServerCapabilities,
    type TextDocuments,
    TextEdit,
    type WorkDoneProgressReporter,
    type WorkspaceEdit,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { getText } from '../utils/biblio.js'
import { word_at_cursor } from '../utils/text.js'
import type { Program } from '../workspace/program.js'

type PrepareResult = Range | { range: Range; placeholder: string } | { defaultBehavior: boolean } | undefined | null
export function renameProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
    capabilities: RenameClientCapabilities | undefined,
): NonNullable<ServerCapabilities['renameProvider']> {
    const Rename = new RenameProvider(capabilities)
    connection.onRenameRequest(Rename.handler(documents, program))
    connection.onPrepareRename(Rename.prepareHandler(documents, program))
    return { prepareProvider: true }
}

export class RenameProvider {
    constructor(public capabilities: RenameClientCapabilities | undefined) {}

    async rename(
        document: TextDocument,
        program: Program,
        params: RenameParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Promise<WorkspaceEdit | undefined> {
        const fullText = document.getText()
        const offset = document.offsetAt(params.position)
        const sourceFile = program.getSourceFile(document)
        const biblio = await program.resolveBiblio(document.uri)

        const { word, isVariable } = word_at_cursor(fullText, offset)
        rejectRenameInBiblio(word, biblio)

        if (isVariable) {
            const node = sourceFile.getAlgHeader(offset)?.parent || sourceFile.findNodeAt(offset)
            const edits: TextEdit[] = []
            for (const vars of sourceFile.getNodeText(node).matchAll(/_(\w+)_/g)) {
                if (vars[1] === word) {
                    edits.push(
                        TextEdit.replace(
                            sourceFile.getRelativeRange(node, {
                                position: vars.index! + 1,
                                length: word.length,
                            }),
                            params.newName,
                        ),
                    )
                }
            }
            return { changes: { [document.uri]: edits } }
        }

        const grammars = sourceFile.localDefinedGrammars.find((grammar) => grammar.name === word)
            ? sourceFile.grammars.filter((grammar) => grammar.name === word)
            : undefined
        if (grammars) {
            const edits: TextEdit[] = []
            for (const grammar of grammars) {
                edits.push(TextEdit.replace(sourceFile.getRelativeRange(grammar.node, grammar.range), params.newName))
            }
            return { changes: { [document.uri]: edits } }
        }

        const operation = sourceFile.findReferenceOfLocalAbstractOperation(word)
        if (operation) {
            return {
                changes: {
                    [document.uri]: operation?.map(
                        (range): TextEdit => ({
                            range,
                            newText: params.newName,
                        }),
                    ),
                },
            }
        }
        return undefined
    }

    async prepare(
        document: TextDocument,
        program: Program,
        params: PrepareRenameParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Promise<PrepareResult> {
        const fullText = document.getText()
        const offset = document.offsetAt(params.position)
        const sourceFile = program.getSourceFile(document)
        const biblio = await program.resolveBiblio(document.uri)

        const { word, leftBoundary, rightBoundary, isVariable } = word_at_cursor(fullText, offset)
        rejectRenameInBiblio(word, biblio)
        if (
            isVariable ||
            sourceFile.localDefinedAbstractOperations.find((op) => op.name === word) ||
            sourceFile.localDefinedGrammars.find((grammar) => grammar.name === word)
        ) {
            return Range.create(sourceFile.text.positionAt(leftBoundary), sourceFile.text.positionAt(rightBoundary))
        }
        return null
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: RenameParams,
            _token?: CancellationToken,
            _workDoneProgress?: WorkDoneProgressReporter,
        ): HandlerResult<WorkspaceEdit | null | undefined, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.rename(document, program, params, _token, _workDoneProgress)
        }
    }

    prepareHandler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: PrepareRenameParams,
            _token?: CancellationToken,
            _workDoneProgress?: WorkDoneProgressReporter,
        ): HandlerResult<PrepareResult, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.prepare(document, program, params, _token, _workDoneProgress)
        }
    }
}

function isInBiblio(word: string, biblio: readonly BiblioEntry[]) {
    return biblio.find((entry) => {
        if (entry.type === 'production' && word === entry.name) return true
        if (entry.type === 'term' && word === entry.term && `%${word}%` === entry.term) return true
        return word === getText(entry)
    })
}

function rejectRenameInBiblio(word: string, biblio: readonly BiblioEntry[]) {
    const target = isInBiblio(word, biblio)
    if (target) {
        switch (target.type) {
            case 'op':
                throw new ResponseError(-1, `Cannot rename an abstract operation defined in the @tc39/biblio.`)
            default:
                throw new ResponseError(-1, `Cannot rename a ${target.type} defined in the @tc39/biblio.`)
        }
    }
}
