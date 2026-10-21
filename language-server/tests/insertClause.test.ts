/// <reference path="../src/biblio.d.ts" />

import { expect, it } from 'vitest'
import { InsertClause } from '../src/features/insertClause.js'
import { applyTextEdit, File } from './File.js'

it('inserts the complete biblio clause hierarchy at the top level', async () => {
    const file = File.basic``
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: { line: 0, character: 0 },
        clauseNumber: '25.1.3',
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)

    expect(result).toContain('<emu-clause id="sec-structured-data" number="25">')
    expect(result).toContain('<emu-clause id="sec-arraybuffer-objects" number="1">')
    expect(result).toContain('<emu-clause id="sec-abstract-operations-for-arraybuffer-objects" number="3">')
    expect(result).toContain('<h1>Abstract Operations For ArrayBuffer Objects</h1>')
})

it('inserts only missing children inside a known numbered clause', async () => {
    const file = File.of`
        <emu-clause id="sec-structured-data" number="25">
            <h1>Structured Data</h1>
            ${File.mark('insert')}
        </emu-clause>
    `
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: file.mark.position,
        clauseNumber: '25.1.3',
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)

    expect(result.match(/<emu-clause id="sec-structured-data" number="25">/gu)).toHaveLength(1)
    expect(result).toContain('<emu-clause id="sec-arraybuffer-objects" number="1">')
    expect(result).toContain('<emu-clause id="sec-abstract-operations-for-arraybuffer-objects" number="3">')
})

it('recognizes a known clause from its h1 when number is absent', async () => {
    const file = File.of`
        <emu-clause id="local-structured-data">
            <h1>Structured Data</h1>
            ${File.mark('insert')}
        </emu-clause>
    `
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: file.mark.position,
        clauseNumber: '25.1.3',
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)

    expect(result).not.toContain('<emu-clause id="sec-structured-data"')
    expect(result).toContain('<emu-clause id="sec-arraybuffer-objects" number="1">')
})

it('resolves relative numbers in nested clauses', async () => {
    const file = File.of`
        <emu-clause id="sec-structured-data" number="25">
            <h1>Structured Data</h1>
            <emu-clause id="sec-arraybuffer-objects" number="1">
                <h1>ArrayBuffer Objects</h1>
                ${File.mark('insert')}
            </emu-clause>
        </emu-clause>
    `
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: file.mark.position,
        clauseNumber: '25.1.3',
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)

    expect(result.match(/<emu-clause id="sec-structured-data"/gu)).toHaveLength(1)
    expect(result.match(/<emu-clause id="sec-arraybuffer-objects" number="1">/gu)).toHaveLength(1)
    expect(result).toContain('<emu-clause id="sec-abstract-operations-for-arraybuffer-objects" number="3">')
})
