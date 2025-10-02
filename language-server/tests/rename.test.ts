import { expect, it } from 'vitest'
import { RenameProvider } from '../src/features/rename.js'
import { betterSnapshot, File, type MarkedRange } from './File.js'

it('rename local defined grammar', async () => {
    const rename = new RenameProvider({})
    const { document, textDocument, program, mark } = File.of`
        <emu-grammar type="definition">
            MoreOneNight :: "more" "one" "night"
            Other
                MoreOneNight
        </emu-grammar>
        <emu-prodref name="MoreOneNight"></emu-prodref>
        <emu-alg>
            1. Let _x_ be Evaluation of |MoreOneNight${File.mark()}|.
        </emu-alg>
    `

    const prepare = await rename.prepare(document, program, { textDocument, position: mark.position })
    expect(prepare).toMatchInlineSnapshot(`
      {
        "end": {
          "character": 53,
          "line": 8,
        },
        "start": {
          "character": 41,
          "line": 8,
        },
      }
    `)

    const result = await rename.rename(document, program, { textDocument, position: mark.position, newName: 'Next' })
    expect(
        betterSnapshot(
            document,
            result?.changes?.[document.uri]?.map(
                ({ newText, range }): MarkedRange => ({ range, annotate: ` renamed to ${newText}` }),
            ),
        ),
    ).toMatchInlineSnapshot(`
      "<emu-grammar type="definition">
          MoreOneNight :: "more" "one" "night"
          ~~~~~~~~~~~~ renamed to Next
          Other
              MoreOneNight
              ~~~~~~~~~~~~ renamed to Next
      </emu-grammar>
      <emu-prodref name="MoreOneNight"></emu-prodref>
                         ~~~~~~~~~~~~ renamed to Next
      <emu-alg>
          1. Let _x_ be Evaluation of |MoreOneNight|.
                                       ~~~~~~~~~~~~ renamed to Next
      </emu-alg>"
    `)
})

it('rename variable', async () => {
    const rename = new RenameProvider({})
    const { document, textDocument, program, mark } = File.of`
        <emu-alg>
            1. Let _x_${File.mark()} be ...
            1. Set _x_ to ...
        </emu-alg>
        <emu-alg>
            1. Let _x_ be ...
            1. Set _x_ to ...
        </emu-alg>
    `

    const prepare = await rename.prepare(document, program, { textDocument, position: mark.position })
    expect(prepare).toMatchInlineSnapshot(`
      {
        "end": {
          "character": 21,
          "line": 2,
        },
        "start": {
          "character": 20,
          "line": 2,
        },
      }
    `)

    const result = await rename.rename(document, program, { textDocument, position: mark.position, newName: 'Next' })
    expect(
        betterSnapshot(
            document,
            result?.changes?.[document.uri]?.map(
                ({ newText, range }): MarkedRange => ({ range, annotate: ` renamed to ${newText}` }),
            ),
        ),
    ).toMatchInlineSnapshot(`
      "<emu-alg>
          1. Let _x_ be ...
                  ~ renamed to Next
          1. Set _x_ to ...
                  ~ renamed to Next
      </emu-alg>
      <emu-alg>
          1. Let _x_ be ...
          1. Set _x_ to ...
      </emu-alg>"
    `)
})

it('rename variable in header', async () => {
    const rename = new RenameProvider({})
    const { document, textDocument, program, mark } = File.of`
        <emu-clause id="sec-test" type="abstract operation">
            <h1>
                Test (
                    _input${File.mark()}_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Set _input_ to ...
            </emu-alg>
        </emu-clause>
    `

    const prepare = await rename.prepare(document, program, { textDocument, position: mark.position })
    expect(prepare).toMatchInlineSnapshot(`
      {
        "end": {
          "character": 26,
          "line": 4,
        },
        "start": {
          "character": 21,
          "line": 4,
        },
      }
    `)

    const result = await rename.rename(document, program, { textDocument, position: mark.position, newName: 'Next' })
    expect(
        betterSnapshot(
            document,
            result?.changes?.[document.uri]?.map(
                ({ newText, range }): MarkedRange => ({ range, annotate: ` renamed to ${newText}` }),
            ),
        ),
    ).toMatchInlineSnapshot(`
      "<emu-clause id="sec-test" type="abstract operation">
          <h1>
              Test (
                  _input_: an ECMAScript language value,
                   ~~~~~ renamed to Next
              ): either a normal completion containing an Object or a throw completion
          </h1>
          <dl class="header">
          </dl>
          <emu-alg>
              1. Set _input_ to ...
                      ~~~~~ renamed to Next
          </emu-alg>
      </emu-clause>"
    `)
})

it('rename variable with header', async () => {
    const rename = new RenameProvider({})
    const { document, textDocument, program, mark } = File.of`
        <emu-clause id="sec-test" type="abstract operation">
            <h1>
                Test (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Set _input${File.mark()}_ to ...
            </emu-alg>
        </emu-clause>
    `

    const prepare = await rename.prepare(document, program, { textDocument, position: mark.position })
    expect(prepare).toMatchInlineSnapshot(`
      {
        "end": {
          "character": 29,
          "line": 10,
        },
        "start": {
          "character": 24,
          "line": 10,
        },
      }
    `)

    const result = await rename.rename(document, program, { textDocument, position: mark.position, newName: 'Next' })
    expect(
        betterSnapshot(
            document,
            result?.changes?.[document.uri]?.map(
                ({ newText, range }): MarkedRange => ({ range, annotate: ` renamed to ${newText}` }),
            ),
        ),
    ).toMatchInlineSnapshot(`
      "<emu-clause id="sec-test" type="abstract operation">
          <h1>
              Test (
                  _input_: an ECMAScript language value,
                   ~~~~~ renamed to Next
              ): either a normal completion containing an Object or a throw completion
          </h1>
          <dl class="header">
          </dl>
          <emu-alg>
              1. Set _input_ to ...
                      ~~~~~ renamed to Next
          </emu-alg>
      </emu-clause>"
    `)
})

it('rename local defined abstract operation', async () => {
    const rename = new RenameProvider({})
    const { document, textDocument, program, mark } = File.of`
        <emu-clause id="sec-test" type="abstract operation">
            <h1>
                Test (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Set _input_ to ...
            </emu-alg>
        </emu-clause>

        <emu-alg>
            1. Set _x_ to Test${File.mark()}().
        </emu-alg>
    `

    const prepare = await rename.prepare(document, program, { textDocument, position: mark.position })
    expect(prepare).toMatchInlineSnapshot(`
      {
        "end": {
          "character": 30,
          "line": 15,
        },
        "start": {
          "character": 26,
          "line": 15,
        },
      }
    `)

    const result = await rename.rename(document, program, { textDocument, position: mark.position, newName: 'Next' })
    expect(
        betterSnapshot(
            document,
            result?.changes?.[document.uri]?.map(
                ({ newText, range }): MarkedRange => ({ range, annotate: ` renamed to ${newText}` }),
            ),
        ),
    ).toMatchInlineSnapshot(`
      "<emu-clause id="sec-test" type="abstract operation">
          <h1>
              Test (
              ~~~~ renamed to Next
                  _input_: an ECMAScript language value,
              ): either a normal completion containing an Object or a throw completion
          </h1>
          <dl class="header">
          </dl>
          <emu-alg>
              1. Set _input_ to ...
          </emu-alg>
      </emu-clause>

      <emu-alg>
          1. Set _x_ to Test().
                        ~~~~ renamed to Next
      </emu-alg>"
    `)
})

it('rename local defined abstract operation in header', async () => {
    const rename = new RenameProvider({})
    const { document, textDocument, program, mark } = File.of`
        <emu-clause id="sec-test" type="abstract operation">
            <h1>
                Test${File.mark()} (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Set _input_ to ...
            </emu-alg>
        </emu-clause>

        <emu-alg>
            1. Set _x_ to Test().
        </emu-alg>
    `

    const prepare = await rename.prepare(document, program, { textDocument, position: mark.position })
    expect(prepare).toMatchInlineSnapshot(`
      {
        "end": {
          "character": 20,
          "line": 3,
        },
        "start": {
          "character": 16,
          "line": 3,
        },
      }
    `)

    const result = await rename.rename(document, program, { textDocument, position: mark.position, newName: 'Next' })
    expect(
        betterSnapshot(
            document,
            result?.changes?.[document.uri]?.map(
                ({ newText, range }): MarkedRange => ({ range, annotate: ` renamed to ${newText}` }),
            ),
        ),
    ).toMatchInlineSnapshot(`
      "<emu-clause id="sec-test" type="abstract operation">
          <h1>
              Test (
              ~~~~ renamed to Next
                  _input_: an ECMAScript language value,
              ): either a normal completion containing an Object or a throw completion
          </h1>
          <dl class="header">
          </dl>
          <emu-alg>
              1. Set _input_ to ...
          </emu-alg>
      </emu-clause>

      <emu-alg>
          1. Set _x_ to Test().
                        ~~~~ renamed to Next
      </emu-alg>"
    `)
})
