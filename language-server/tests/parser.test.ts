import { expect, it } from 'vitest'
import { TextDocument } from '../src/lib.js'
import { dedent, EcmarkupDocument } from '../src/utils/parse.js'

it('parses', () => {
    const doc = new EcmarkupDocument(
        TextDocument.create(
            'test://test.emu',
            'ecmarkup',
            0,
            `
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
          "name": "MoreOneNight",
          "pos": 21,
          "summary": "MoreOneNight :: "more" "one" "night"",
          "type": "define",
        },
      ]
    `)
    expect(doc.localDefinedAbstractOperations.map(({ node, ...rest }) => rest)).toMatchInlineSnapshot(`
      [
        {
          "name": "MyFunction",
          "pos": 25,
          "summary": "MyFunction (
          _input_: an ECMAScript language value,
      ): either a normal completion containing an Object or a throw completion",
          "type": "define",
        },
      ]
    `)
})

it('dedent', () => {
    expect(
        dedent(`
    Head
      Body
  `),
    ).toMatchInlineSnapshot(`
    "Head
      Body"
  `)
})
