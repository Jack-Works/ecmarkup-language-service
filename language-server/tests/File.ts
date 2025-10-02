import { hash } from 'node:crypto'
import dedent from 'dedent-js'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { type Position, Range, type TextDocumentIdentifier } from 'vscode-languageserver-types'
import type { IO } from '../src/workspace/io.js'
import { createProgram } from '../src/workspace/program.js'

export interface Mark {
    desc: string | undefined
    position: Position
    around: string
}

export class File {
    constructor(public document: TextDocument) {
        this.textDocument = { uri: this.document.uri }
    }
    textDocument: TextDocumentIdentifier
    mark!: Mark
    markers: Mark[] = []
    program = createProgram(mockIO({}))
    static of(text: TemplateStringsArray, ...markers: [symbol, ...symbol[]]) {
        const full = text.join('')
        const document = TextDocument.create(`test://${hash('md5', full)}.emu`, 'ecmarkup', 0, full)
        let pos = 0
        const positions: Mark[] = []
        for (const [i, marker] of markers.entries()) {
            pos += text[i]!.length
            const before = full.slice(full.slice(0, pos).lastIndexOf('\n') + 1, pos)
            const after = full.slice(pos, pos + full.slice(pos).indexOf('\n'))
            positions.push({
                desc: marker.description,
                position: document.positionAt(pos),
                around: `${before}🔽${after}`.trim(),
            })
        }
        const file = new File(document)
        file.markers = positions
        file.mark = positions[0]!
        return file
    }

    static basic(text: TemplateStringsArray) {
        const full = text.join('')
        const document = TextDocument.create(`test://${hash('md5', full)}.emu`, 'ecmarkup', 0, full)
        const file = new File(document)
        return file
    }
    static mark = Symbol
}

export interface MarkedRange {
    range: Range
    annotate: string
}

export interface MarkedOffset {
    offset: number
    length: number
    annotate: string
}
export function betterSnapshot(document: TextDocument, mark_ranges: undefined | (MarkedRange | MarkedOffset)[]) {
    if (!mark_ranges) return '<no mark>'
    const textLined = document.getText().split('\n')
    const linesToInsert: [line: number, start: number, annotate: string][] = []
    ;(mark_ranges as (MarkedOffset & MarkedRange)[]).forEach(({ range, annotate: annotate_text, length, offset }) => {
        let startLine: number, startCharacter: number, endLine: number, endCharacter: number
        if (Range.is(range)) {
            startLine = range.start.line
            endLine = range.end.line

            startCharacter = range.start.character
            endCharacter = range.end.character

            length = range.end.character - range.start.character
        } else if (length !== undefined && offset !== undefined) {
            ;({ character: startCharacter, line: startLine } = document.positionAt(offset))
            endLine = startLine
            endCharacter = startCharacter + length
        } else {
            throw new Error('both range, offset and length are missing')
        }
        if (startLine === endLine) {
            const annotate = `${' '.repeat(startCharacter)}${'~'.repeat(length)}${annotate_text}`
            linesToInsert.push([startLine, startCharacter, annotate])
        } else {
            const annotate = `${' '.repeat(startCharacter)}~~... (a multiline line annotate) ${annotate_text}`
            const annotate2 = `${' '.repeat(endCharacter)}^ (a multiline annotate ends here)`
            linesToInsert.push([startLine, startCharacter, annotate])
            linesToInsert.push([endLine, endCharacter, annotate2])
        }
    })
    linesToInsert
        .sort((a, b) => b[0] - a[0] || b[1] - a[1])
        .forEach(([lineNo, , line]) => {
            textLined.splice(lineNo + 1, 0, line)
        })
    return dedent(textLined.join('\n'))
}

export function mockIO(io: Partial<IO>): IO {
    return {
        async resolveBiblio() {
            return undefined
        },
        async warn(...message) {
            console.warn(...message)
        },
        async getEditorCursorCount() {
            return 1
        },
        ...io,
    }
}
