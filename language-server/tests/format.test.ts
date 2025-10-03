import { expect, it } from 'vitest'
import { Formatter } from '../src/features/format.js'
import { applyTextEdit, File } from './File.js'

it('format', async () => {
    const formatter = new Formatter({})
    const { document, textDocument } = File.basic`
    <emu-alg>1. TODO.</emu-alg>
    `
    const result = await formatter.format(document, { options: { insertSpaces: true, tabSize: 2 }, textDocument })
    expect(applyTextEdit(document, result)).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <emu-alg>
        1. TODO.
      </emu-alg>
      "
    `)
})

it('format on range', async () => {
    expect(
        await format`
    ${File.mark()}<!doctype html>
    <meta charset="utf8">

    <emu-clause id="sec-overview" number="4">
      <h1>Overview</h1>

      <emu-clause id="sec-organization-of-this-specification" number="5"><h1>Organization of This Specification</h1>
        <p><ins>Clause <emu-xref href="#sec-pattern-matching"></emu-xref> describes the pattern-matching feature.</ins></p>
      </emu-clause>
    </emu-clause> ${File.mark()}
    `,
    ).toMatchInlineSnapshot(`
      "
          <!doctype html>
          <meta charset="utf8">

          <emu-clause id="sec-overview" number="4">
            <h1>Overview</h1>

            <emu-clause id="sec-organization-of-this-specification" number="5">
              <h1>Organization of This Specification</h1>
              <p><ins>Clause <emu-xref href="#sec-pattern-matching"></emu-xref> describes the pattern-matching feature.</ins></p>
            </emu-clause>
          </emu-clause>
       
      "
    `)

    expect(
        await format`
    <!doctype html>
    <meta charset="utf8">

    <emu-clause id="sec-overview" number="4">
      <h1>Overview</h1>

      <emu-clause id="sec-organization-of-this-specification" number="5"><h1>Organization ${File.mark()}of This Specification</h1><p> Or &gt; </p>
        <p><ins>Clause <emu-xref href="#sec-pattern-matching"></emu-xref> describes the pattern-matching         feature.</ins></p>
      </emu-clause>
    </emu-clause> ${File.mark()}
    `,
    ).toMatchInlineSnapshot(`
      "
          <!doctype html>
          <meta charset="utf8">

          
            <emu-clause id="sec-overview" number="4">
              <h1>Overview</h1>

              <emu-clause id="sec-organization-of-this-specification" number="5">
                <h1>Organization of This Specification</h1>
                <p>Or ></p>
                <p><ins>Clause <emu-xref href="#sec-pattern-matching"></emu-xref> describes the pattern-matching feature.</ins></p>
              </emu-clause>
            </emu-clause>
       
          "
    `)
})

async function format(source: TemplateStringsArray, symbol: symbol, ...symbols: symbol[]) {
    const formatter = new Formatter({})
    const { document, textDocument, markers, program } = File.of(source, symbol, ...symbols)
    const result = await formatter.formatRange(document, program, {
        options: { insertSpaces: true, tabSize: 2 },
        range: { start: markers[0]!.position, end: markers[1]!.position },
        textDocument,
    })
    return applyTextEdit(document, result)
}
