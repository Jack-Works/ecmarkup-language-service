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

it('renders an abstract operation clause with its signature header', async () => {
    const file = File.basic``
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: { line: 0, character: 0 },
        clauseNumber: '25.1.3.1',
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)
    expect(result).toMatchInlineSnapshot(`
      "<emu-clause id="sec-structured-data" number="25">
        <h1>Structured Data</h1>
        <emu-clause id="sec-arraybuffer-objects" number="1">
          <h1>ArrayBuffer Objects</h1>
          <emu-clause id="sec-abstract-operations-for-arraybuffer-objects" number="3">
            <h1>Abstract Operations For ArrayBuffer Objects</h1>
            <emu-clause id="sec-allocatearraybuffer" number="1" type="abstract operation">
              <h1>
                AllocateArrayBuffer (
                  _ctor_: a constructor,
                  _byteLength_: a non-negative integer,
                  optional _maxByteLength_: a non-negative integer or ~empty~,
                ): either a normal completion containing an ArrayBuffer or a throw completion
              </h1>
              <dl class="header">
              </dl>

            </emu-clause>
          </emu-clause>
        </emu-clause>
      </emu-clause>
      "
    `)
})

it('uses the requested indentation size when rendering clauses', async () => {
    const file = File.basic``
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: { line: 0, character: 0 },
        clauseNumber: '25.1.3',
        indentSize: 4,
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)
    expect(result).toMatchInlineSnapshot(`
      "<emu-clause id="sec-structured-data" number="25">
          <h1>Structured Data</h1>
          <emu-clause id="sec-arraybuffer-objects" number="1">
              <h1>ArrayBuffer Objects</h1>
              <emu-clause id="sec-abstract-operations-for-arraybuffer-objects" number="3">
                  <h1>Abstract Operations For ArrayBuffer Objects</h1>

              </emu-clause>
          </emu-clause>
      </emu-clause>
      "
    `)
})

it('inserts a non-abstract operation clause with its HTML title', async () => {
    const file = File.basic``
    const provider = new InsertClause(file.program)

    const edits = await provider.insert(file.document, {
        textDocument: file.textDocument,
        position: { line: 0, character: 0 },
        clauseNumber: '23.2.3.23',
    })
    if (!edits) throw new Error('Expected an insertion edit')
    const result = applyTextEdit(file.document, edits)
    expect(result).toMatchInlineSnapshot(`
      "<emu-clause id="sec-indexed-collections" number="23">
        <h1>Indexed Collections</h1>
        <emu-clause id="sec-typedarray-objects" number="2">
          <h1>TypedArray Objects</h1>
          <emu-clause id="sec-properties-of-the-%typedarrayprototype%-object" number="3">
            <h1>Properties of the %TypedArray% Prototype Object</h1>
            <emu-clause id="sec-%typedarray%.prototype.reduce" number="23">
              <h1>%TypedArray%.prototype.reduce ( _callback_ [ , _initialValue_ ] )</h1>
              
            </emu-clause>
          </emu-clause>
        </emu-clause>
      </emu-clause>
      "
    `)
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
