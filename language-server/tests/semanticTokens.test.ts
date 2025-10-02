import { expect, it } from 'vitest'
import {
    SemanticToken,
    type SemanticTokenData,
    SemanticTokenModifiers,
    SemanticTokenTypes,
} from '../src/features/semanticTokens.js'
import type { TextDocument } from '../src/lib.js'
import { betterSnapshot, File } from './File.js'

it('highlights AO header', async () => {
    const semanticTokens = new SemanticToken()
    const { document, textDocument, program } = File.basic`
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
        </emu-clause>

        <emu-clause id="sec-OpenCalc" type="abstract operation">
            <h1>
                OpenCalc (
                    _input_: an ECMAScript language value,
                    [_input2_]: an ECMAScript language value,
                ): an Object
            </h1>
            <dl class="header">
            </dl>
        </emu-clause>

        <emu-clause id="sec-OpenCalc" type="abstract operation">
            <h1>
                OpenCalc (
                    _input_,
                    [ _input2_ ],
                ): an Object
            </h1>
            <dl class="header">
            </dl>
        </emu-clause>

        <emu-clause id="sec-OpenCalc" type="abstract operation">
            <h1>
                Runtime Semantics: OpenCalc ( ): an Object
            </h1>
            <dl class="header">
            </dl>
        </emu-clause>
    `
    const result = await semanticTokens.tokenize(document, program, { textDocument })
    expect(printTokens(document, result)).toMatchInlineSnapshot(`
      "<emu-clause id="sec-OpenCalc" type="abstract operation">
          <h1>
              OpenCalc (
              ~~~~~~~~~ function
                  _input_: an ECMAScript language value,
                   ~~~~~ variable
                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ type
                  _input2_: an ECMAScript language value,
                   ~~~~~~ variable
                            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ type
                  [ _input3_: an ECMAScript language value, ]
                     ~~~~~~ variable
                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ type
              ): either a normal completion containing an Object or a throw completion
                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ type
          </h1>
          <dl class="header">
          </dl>
      </emu-clause>

      <emu-clause id="sec-OpenCalc" type="abstract operation">
          <h1>
              OpenCalc (
              ~~~~~~~~~ function
                  _input_: an ECMAScript language value,
                   ~~~~~ variable
                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ type
                  [_input2_]: an ECMAScript language value,
                    ~~~~~~ variable
                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ type
              ): an Object
                 ~~~~~~~~~ type
          </h1>
          <dl class="header">
          </dl>
      </emu-clause>

      <emu-clause id="sec-OpenCalc" type="abstract operation">
          <h1>
              OpenCalc (
              ~~~~~~~~~ function
                  _input_,
                   ~~~~~ variable
                  [ _input2_ ],
                     ~~~~~~ variable
              ): an Object
                 ~~~~~~~~~ type
          </h1>
          <dl class="header">
          </dl>
      </emu-clause>

      <emu-clause id="sec-OpenCalc" type="abstract operation">
          <h1>
              Runtime Semantics: OpenCalc ( ): an Object
              ~~~~~~~~~~~~~~~~~~ comment
                                 ~~~~~~~~~ function
                                               ~~~~~~~~~ type
          </h1>
          <dl class="header">
          </dl>
      </emu-clause>"
    `)
    expect(result).toMatchSnapshot()
})

it('highlights User Code calls in algorithms', async () => {
    const semanticTokens = new SemanticToken()
    const { document, textDocument, program } = File.basic`
        <emu-alg>
            1. Let _x_ be ? Get(_obj_, _propKey_).
        </emu-alg>
    `
    const result = await semanticTokens.tokenize(document, program, { textDocument })
    expect(printTokens(document, result)).toMatchInlineSnapshot(`
      "<emu-alg>
          1. Let _x_ be ? Get(_obj_, _propKey_).
                          ~~~ function, modifiers: mutable
      </emu-alg>"
    `)
})

function printTokens(document: TextDocument, tokens: SemanticTokenData[]) {
    return betterSnapshot(
        document,
        tokens.map(({ length, modifier, offset, tokenType }) => ({
            offset,
            length,
            annotate: ` ${SemanticTokenTypes[tokenType]}${modifier.length ? ', modifiers: ' : ''}${modifier.map((modifier) => SemanticTokenModifiers[modifier]).join(',')}`,
        })),
    )
}
