import { expect, it } from 'vitest'
import { GoToDefinition } from '../src/features/gotoDefinition.js'
import { File } from './File.js'

it('go to definition', async () => {
    const goto = new GoToDefinition()
    const { document, markers, textDocument, program } = File.of`
        <emu-grammar type="definition">
            MoreOneNight ::= "more" "one" "night"
        </emu-grammar>
        <p>A |MoreOneNight${File.mark('grammar')}| production.</p>
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
        const result = goto.onDefinition(document, program, { textDocument, position })
        expect([around, result]).toMatchSnapshot(desc)
    }
})
