import { hash } from 'node:crypto'
import { type Position, Range, type TextDocumentIdentifier } from 'vscode-languageserver-types'
import { TextDocument } from '../src/lib.js'
import { dedent } from '../src/utils/parse.js'
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
        const full = dedent(text.join(''))
        const document = TextDocument.create(`test://${hash('md5', full)}.emu`, 'ecmarkup', 0, full)
        const file = new File(document)
        return file
    }
    static mark = Symbol
}

export function betterSnapshot(
    document: TextDocument,
    mark_ranges: { range?: Range; offset?: number; length?: number; annotate: string }[],
) {
    const textLined = document.getText().split('\n')
    ;[...mark_ranges].reverse().forEach(({ range, annotate: annotate_text, length, offset }) => {
        let line: number, character: number
        if (Range.is(range)) {
            line = range.start.line
            character = range.start.character
            length = range.end.character - range.start.character
            if (range.end.line !== range.start.line) throw new Error('Cannot annotate multi-line ranges yet')
        } else if (length !== undefined && offset !== undefined) {
            ;({ character, line } = document.positionAt(offset))
        } else {
            throw new Error()
        }
        const annotate = `${' '.repeat(character)}${'~'.repeat(length)}${annotate_text}`
        textLined.splice(line + 1, 0, annotate)
    })
    return textLined.join('\n')
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
