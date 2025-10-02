import { expect, it } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { EcmarkupDocument } from '../src/parser/ecmarkup.js'

it('parses', () => {
    const doc = new EcmarkupDocument(
        TextDocument.create(
            'test://test.emu',
            'ecmarkup',
            0,
            `
                <meta />
                <emu-grammar type="definition">
                    MoreOneNight :: "more" "one" "night"
                </emu-grammar>
                <emu-clause id="sec-MyFunction" type="abstract operation">
                    <h1>
                        MyFunction (
                            _input_: an ECMAScript language value,
                        ): either a normal completion containing an Object or a throw completion
                    </h1>
                    <dl class="header">
                    </dl>
                    <emu-alg>
                        1. TODO.
                    </emu-alg>
                </emu-clause>
            `,
        ),
    )
    expect(doc.localDefinedGrammars.map(({ node, ...rest }) => rest)).toMatchInlineSnapshot(`
      [
        {
          "fullDefinitionRange": {
            "length": 36,
            "position": 52,
          },
          "name": "MoreOneNight",
          "range": {
            "length": 12,
            "position": 52,
          },
          "summary": "MoreOneNight :: "more" "one" "night"",
          "type": "define",
        },
      ]
    `)
    expect(doc.localDefinedAbstractOperations.map(({ node, ...rest }) => rest)).toMatchInlineSnapshot(`
      [
        {
          "fullDefinitionRange": {
            "length": 176,
            "position": 29,
          },
          "name": "MyFunction",
          "range": {
            "length": 10,
            "position": 29,
          },
          "summary": "MyFunction (
          _input_: an ECMAScript language value,
      ): either a normal completion containing an Object or a throw completion",
          "type": "define",
        },
      ]
    `)
})
