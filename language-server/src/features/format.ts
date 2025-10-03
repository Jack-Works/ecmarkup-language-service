import type { ChildNode, Node } from 'parse5'
import { isCommentNode, isElementNode, isTextNode } from 'parse5/lib/tree-adapters/default.js'
import {
    type Connection,
    type DocumentFormattingClientCapabilities,
    type DocumentFormattingParams,
    type DocumentOnTypeFormattingParams,
    type DocumentRangeFormattingParams,
    type ServerCapabilities,
    type TextDocumentClientCapabilities,
    TextEdit,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Program } from '../workspace/program.js'

import formatter = require('ecmarkup/lib/formatter/ecmarkup.js')

import { documents } from '../server-shared.js'

export class Formatter {
    constructor(public capabilities: DocumentFormattingClientCapabilities | undefined) {}

    async format(document: TextDocument, _params: DocumentFormattingParams): Promise<TextEdit[] | undefined> {
        const formatted = await formatter.printDocument(document.getText())
        return [
            TextEdit.replace(
                { start: document.positionAt(0), end: document.positionAt(document.getText().length) },
                formatted,
            ),
        ]
    }

    async formatRange(
        document: TextDocument,
        program: Program,
        params: DocumentRangeFormattingParams,
    ): Promise<TextEdit[] | undefined> {
        const { range } = params
        const sourceFile = program.getSourceFile(document)
        const source = document.getText()

        let start_offset = sourceFile.text.offsetAt(range.start)
        let end_offset = sourceFile.text.offsetAt(range.end)
        // in the following case, we don't want to format the parent element
        // <parent>
        //     <child>^
        //         no range, vscode will select the whole line, and match the whitespace of the parent tag
        //     </child>
        // </parent>
        {
            const slice = source.slice(start_offset, end_offset)
            start_offset += slice.length - slice.trimStart().length
            end_offset -= slice.length - slice.trimEnd().length
        }

        const start = sourceFile.findNodeAt(start_offset)
        const end = sourceFile.findNodeAt(end_offset)
        if (!start || !end) return undefined

        const specified_format_range = findFormatRange(start, end)
        const formatable_nodes = specified_format_range.flatMap((node) => [...findChildrenWithRange(node)])
        if (specified_format_range.length === 0) return undefined
        const edits: TextEdit[] = []
        await Promise.all(
            formatable_nodes.map(async (node) => {
                if (isElementNode(node) || isCommentNode(node) || isTextNode(node)) {
                    let indent_count = 0

                    if (
                        !source.slice(node.sourceCodeLocation!.startOffset, node.sourceCodeLocation!.endOffset).trim()
                    ) {
                        return
                    }
                    const line = sourceFile.text.positionAt(node.sourceCodeLocation!.startOffset).line
                    const first_line = source.slice(
                        sourceFile.text.offsetAt({ line, character: 0 }),
                        sourceFile.text.offsetAt({ line: line + 1, character: 0 }),
                    )
                    indent_count = first_line.length - first_line.trimStart().length

                    const formatted = await formatter.printChildNodes(source, [node], false, false, indent_count / 2)
                    edits.push(
                        TextEdit.replace(
                            {
                                // virtualized html, head, body node will have no location information
                                start: sourceFile.text.positionAt(node.sourceCodeLocation!.startOffset),
                                end: sourceFile.text.positionAt(node.sourceCodeLocation!.endOffset),
                            },
                            formatted.lines.join('\n').trim(),
                        ),
                    )
                }
            }),
        )
        return edits
    }

    async formatOnType(
        document: TextDocument,
        program: Program,
        params: DocumentOnTypeFormattingParams,
    ): Promise<TextEdit[] | undefined> {
        const sourceFile = program.getSourceFile(document)
        const source = document.getText()
        const cursorAt = sourceFile.text.offsetAt(params.position)
        if (source[cursorAt] === '\n' && sourceFile.findElementAt(cursorAt)?.tagName === 'emu-alg') {
            return this.formatRange(document, program, {
                range: {
                    start: params.position,
                    end: params.position,
                },
                options: params.options,
                textDocument: params.textDocument,
            })
        }
        return undefined
    }

    static enable(
        serverCapabilities: ServerCapabilities<never>,
        connection: Connection,
        program: Program,
        capabilities: TextDocumentClientCapabilities | undefined,
    ) {
        const provider = new Formatter(capabilities?.formatting)
        connection.onDocumentFormatting((params, _token, _workDoneProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return provider.format(document, params)
        })
        connection.onDocumentRangeFormatting((params, _token, _workDoneProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return provider.formatRange(document, program, params)
        })
        connection.onDocumentOnTypeFormatting((params, _token) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return provider.formatOnType(document, program, params)
        })
        serverCapabilities.documentFormattingProvider = {}
        serverCapabilities.documentRangeFormattingProvider = {}
        serverCapabilities.documentOnTypeFormattingProvider = { firstTriggerCharacter: '.' }
    }
}

function findFormatRange(a: Node, b: Node): Node[] {
    const parent_a: Node[] = []
    const parent_b: Node[] = []

    for (let init: Node = a; 'parentNode' in init; init = init.parentNode) {
        parent_a.unshift(init)
        if (init.parentNode.nodeName === '#document') {
            parent_a.unshift(init.parentNode)
        }
    }
    for (let init: Node = b; 'parentNode' in init; init = init.parentNode) {
        parent_b.unshift(init)
        if (init.parentNode.nodeName === '#document') {
            parent_b.unshift(init.parentNode)
        }
    }

    let last_access: Node | undefined
    for (let index = 0; index < parent_a.length && index < parent_b.length; index++) {
        const element_a = parent_a[index]!
        const element_b = parent_b[index]!
        last_access = element_a
        if (element_a !== element_b) {
            const parent = parent_a[index - 1]!
            if ('childNodes' in parent) {
                const from = parent.childNodes.indexOf(element_a as ChildNode)
                const to = parent.childNodes.indexOf(element_b as ChildNode) + 1
                if (from === -1 || to === -1) throw new Error('Unknown case')
                return parent.childNodes.slice(from, to)
            } else {
                throw new Error('Unknown case')
            }
        }
    }
    if (!last_access) throw new Error('Unknown case')
    return [last_access]
}

function* findChildrenWithRange(node: Node): Generator<Node> {
    if ('sourceCodeLocation' in node && node.sourceCodeLocation) {
        if (isTextNode(node) && 'sourceCodeLocation' in node.parentNode && node.parentNode.sourceCodeLocation)
            yield node.parentNode
        else yield node
    } else if ('childNodes' in node) {
        for (const child of node.childNodes) {
            yield* findChildrenWithRange(child)
        }
    }
}
