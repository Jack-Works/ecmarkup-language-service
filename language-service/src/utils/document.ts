import { TextDocument, type TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'
import utils from '../../ecmarkup/lib/utils.js'
import { Spec } from '../ecmarkup.js'
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types'
import { createPosition, createRange, createRangeZeroLength, unreachable } from './utils.js'
import type { Warning } from '../../ecmarkup/lib/Spec.js'
import { getBiblio } from './biblio.js'

export class SourceFile {
    constructor(public readonly uri: string, public readonly languageId: string, public readonly text: TextDocument) {}

    #node: Spec | undefined
    get node() {
        if (!this.#node) {
            const html = this.text.getText()
            const dom = utils.htmlToDom(html)
            const biblio = getBiblio(this.uri)
            const biblios = Array.isArray(biblio) ? biblio : [biblio]
            this.#node = new Spec(
                this.uri,
                (url) => {
                    return fetch(url).then(x => x.text())
                },
                dom,
                { lintSpec: true, extraBiblios: biblios },
                html
            )
        }
        return this.#node
    }
    #progressingBuild = new Map<number, Promise<Diagnostic[]>>()
    build() {
        if (this.#progressingBuild.has(this.text.version)) return this.#progressingBuild.get(this.text.version)!

        const diagnostics: Diagnostic[] = []
        this.node.warn = (err) => {
            const diag = this.#toDiagnostic(err)
            if (!diag) return
            diagnostics.push(diag)
        }
        const promise = this.node.build().then(() => diagnostics)
        this.#progressingBuild.set(this.text.version, promise)
        return promise
    }
    relativeToPos(node: Node, nodeRelativeLine: number, nodeRelativeColumn: number) {
        const loc = this.node.locate(node)
        if (!loc) return
        let line: number, column: number

        if (node.nodeType === 3 /* Node.TEXT_NODE */) {
            line = loc.startLine + nodeRelativeLine - 1
            column = nodeRelativeLine === 1 ? loc.startCol + nodeRelativeColumn - 1 : nodeRelativeColumn
        } else {
            line = loc.startTag.endLine + nodeRelativeLine - 1
            column = nodeRelativeLine === 1 ? loc.startTag.endCol + nodeRelativeColumn - 1 : nodeRelativeColumn
        }
        return createPosition(line - 1, column - 1)
    }
    #toDiagnostic(err: Warning) {
        const diagnostic: Diagnostic = {
            message: err.message,
            code: err.ruleId,
            severity: DiagnosticSeverity.Error,
            range: createRange(createPosition.zero, createPosition.zero),
            source: 'ecmarkup',
        }
        if (err.type === 'attr' || err.type === 'attr-value') {
            const loc = this.node.locate(err.node)
            const attr = loc?.startTag.attrs?.[err.attr]
            if (attr) {
                diagnostic.range = createRange(
                    createPosition(attr.startLine - 1, attr.startCol - 1),
                    createPosition(attr.endLine - 1, attr.endCol - 1)
                )
            } else if (loc) {
                diagnostic.range = createRange(
                    createPosition(loc.startTag.startLine - 1, loc.startTag.startCol - 1),
                    createPosition(loc.endTag.endLine - 1, loc.endTag.endCol - 1)
                )
            }
        } else if (err.type === 'contents') {
            const { nodeRelativeColumn, nodeRelativeLine } = err
            const loc = this.relativeToPos(err.node, nodeRelativeLine, nodeRelativeColumn)
            if (loc) diagnostic.range = createRangeZeroLength(loc)
        } else if (err.type === 'global') {
            // No location information available
        } else if (err.type === 'node') {
            const loc = this.node.locate(err.node)
            if (loc)
                diagnostic.range = createRange(
                    createPosition(loc.startLine - 1, loc.startCol - 1),
                    createPosition(loc.endLine - 1, loc.endCol - 1)
                )
        } else if (err.type === 'raw') {
            diagnostic.range = createRangeZeroLength(createPosition(err.line, err.column))
        } else unreachable(err)

        return diagnostic
    }
    static create(uri: string, languageId: string, version: number, content: string): SourceFile {
        return new SourceFile(uri, languageId, TextDocument.create(uri, languageId, version, content))
    }
    static update(document: SourceFile, changes: TextDocumentContentChangeEvent[], version: number): SourceFile {
        document.#node = undefined
        TextDocument.update(document.text, changes, version)
        return document
    }
}
