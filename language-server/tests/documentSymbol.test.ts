import { expect, it } from 'vitest'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { type DocumentSymbol, type SymbolInformation, SymbolKind } from 'vscode-languageserver-types'
import { DocumentSymbolProvider } from '../src/features/documentSymbol.js'
import { betterSnapshot, File, type MarkedOffset, type MarkedRange } from './File.js'

it('provides document symbols', async () => {
    const documentSymbol = new DocumentSymbolProvider()
    const { document, textDocument, program } = File.basic`
        <!doctype html>
        <emu-clause id="sec-OpenCalc" type="abstract operation">
            <h1>
                OpenCalc (
                    _input_: an ECMAScript language value,
                    _input2_: an ECMAScript language value,
                    [ _input3_: an ECMAScript language value, ]
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Let _x_ be ? ToObject(_input_).
                2. Let _y_ be ? ToObject(_input2_).
                3. Set _y_ to ? ToObject(_input2_).
                4. Return the result of calling User Code with _x_ as this value and _y_ as the first argument.
            </emu-alg>
        </emu-clause>
    `
    const result = await documentSymbol.findDocumentSymbols(document, program, { textDocument })
    expect(printSymbols(document, result!)).toMatchInlineSnapshot(`
      "<!doctype html>
      <emu-clause id="sec-OpenCalc" type="abstract operation">
          <h1>
              OpenCalc (
              ~~~~~~~~ OpenCalc (Function) (input, input2, input3): NormalCompletion<an Object> | ThrowCompletion
                  _input_: an ECMAScript language value,
                   ~~~~~ input (Variable)
                  _input2_: an ECMAScript language value,
                   ~~~~~~ input2 (Variable)
                  [ _input3_: an ECMAScript language value, ]
                     ~~~~~~ input3 (Variable)
              ): either a normal completion containing an Object or a throw completion
          </h1>
          <dl class="header">
          </dl>
          <emu-alg>
              1. Let _x_ be ? ToObject(_input_).
                      ~ x (Variable)
              2. Let _y_ be ? ToObject(_input2_).
                      ~ y (Variable)
              3. Set _y_ to ? ToObject(_input2_).
              4. Return the result of calling User Code with _x_ as this value and _y_ as the first argument.
          </emu-alg>
      </emu-clause>"
    `)
    expect(result).toMatchSnapshot()

    documentSymbol.capabilities = undefined
    const result2 = await documentSymbol.findDocumentSymbols(document, program, { textDocument })
    expect(printSymbols(document, result2!)).toMatchInlineSnapshot(`
      "<!doctype html>
      <emu-clause id="sec-OpenCalc" type="abstract operation">
          <h1>
              OpenCalc (
              ~~~~~~~~ OpenCalc (Function)
                  _input_: an ECMAScript language value,
                  _input2_: an ECMAScript language value,
                  [ _input3_: an ECMAScript language value, ]
              ): either a normal completion containing an Object or a throw completion
          </h1>
          <dl class="header">
          </dl>
          <emu-alg>
              1. Let _x_ be ? ToObject(_input_).
              2. Let _y_ be ? ToObject(_input2_).
              3. Set _y_ to ? ToObject(_input2_).
              4. Return the result of calling User Code with _x_ as this value and _y_ as the first argument.
          </emu-alg>
      </emu-clause>"
    `)
    expect(result2).toMatchSnapshot()
})

function printSymbols(document: TextDocument, tokens: (DocumentSymbol | SymbolInformation)[]) {
    return betterSnapshot(
        document,
        tokens.flatMap(function toMarked(symbol): (MarkedRange | MarkedOffset)[] {
            if ('location' in symbol) {
                const { location, kind, name } = symbol
                return [
                    {
                        range: location.range,
                        annotate: ` ${name} (${printKind(kind)})`,
                    },
                ]
            } else {
                const { kind, name, selectionRange, detail, children } = symbol
                return [
                    {
                        annotate: ` ${name} (${printKind(kind)}) ${detail || ''}`.trimEnd(),
                        range: selectionRange,
                    } as MarkedRange | MarkedOffset,
                ].concat(children ? children.flatMap(toMarked) : [])
            }
        }),
    )
}

function printKind(symbol: SymbolKind) {
    return Object.entries(SymbolKind).find(([, value]) => value === symbol)?.[0]
}
