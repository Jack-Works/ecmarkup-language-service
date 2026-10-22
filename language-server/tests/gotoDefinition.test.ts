import { expect, it } from 'vitest'
import { GoToDefinition } from '../src/features/gotoDefinition.js'
import { createProgram } from '../src/workspace/program.js'
import { File, mockClient } from './File.js'

it('go to definition', async () => {
    const goto = new GoToDefinition()
    const { document, markers, textDocument, program } = File.of`
        <emu-grammar type="definition">
            MoreOneNight ::= "more" "one" "night"
        </emu-grammar>
        <p>A |MoreOneNight${File.mark('grammar')}| production.</p>
        <emu-prodref name="MoreOneNight${
            // TODO: not working yet
            File.mark('emu-prodref')
        }"></emu-prodref>
        <emu-grammar>
            Other
                MoreOneNight${File.mark('grammar in grammar')}
        </emu-grammar>

        <emu-clause id="sec-SaveTheWorld" type="abstract operation">
            <h1>
                SaveTheWorld (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Let _obj_ be ! OrdinaryObjectCreate(_input_${File.mark('parameter')}).
                1. Perform ? FinishSavingTheWorld(_obj_${File.mark('local variable')}).
            </emu-alg>
        </emu-clause>
        <emu-alg>
            1. Perform ? SaveThe${File.mark('AO')}World(  ).
        </emu-alg>
    `

    for (const { position, around, desc } of markers) {
        const result = await goto.onDefinition(document, program, { textDocument, position })
        expect([around, result]).toMatchSnapshot(desc)
    }

    goto.capabilities = { linkSupport: true }
    for (const { position, around, desc } of markers) {
        const result = await goto.onDefinition(document, program, { textDocument, position })
        expect([around, result]).toMatchSnapshot('linkSupport: ' + desc)
    }
})

it('go to a definition in the local ECMA-262 repository', async () => {
    const goto = new GoToDefinition({ linkSupport: true })
    const file = File.of`
        <emu-alg>
            1. Perform ? OrdinaryObjectCreate${File.mark('external AO')}( *null* ).
        </emu-alg>
    `
    const sourceUri = 'file:///ecma262/spec.html'
    const sourceText = `<emu-clause id="sec-ordinaryobjectcreate" type="abstract operation">
<h1>OrdinaryObjectCreate ( _proto_: an Object ): an Object</h1>
<dl class="header"></dl>
</emu-clause>`
    const program = createProgram(
        mockClient({
            async resolveEcma262Source() {
                return { uri: sourceUri, text: sourceText }
            },
        }),
    )

    const result = await goto.onDefinition(file.document, program, {
        textDocument: file.textDocument,
        position: file.mark.position,
    })

    expect(result).toEqual([
        expect.objectContaining({
            targetUri: sourceUri,
            targetSelectionRange: {
                start: { line: 1, character: 4 },
                end: { line: 1, character: 24 },
            },
        }),
    ])
})
