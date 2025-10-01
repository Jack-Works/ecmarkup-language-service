import { expect, it } from 'vitest'
import { MarkupKind } from 'vscode-languageserver-types'
import { HoverProvider } from '../src/features/hover.js'
import { File } from './File.js'

const capabilities = { contentFormat: [MarkupKind.Markdown, MarkupKind.PlainText] }
it('hover on biblio entries', async () => {
    const hover = new HoverProvider(capabilities)
    const { document, textDocument, markers, program } = File.of`
        Expression${File.mark('expression')}
        Call${File.mark('call')}
        %AsyncFunction${File.mark('asyncFunction')}%
        Assert${File.mark('assert')}
    `
    for (const { desc, position, around } of markers) {
        const result = await hover.hover(document, program, { textDocument, position })
        expect([around, result]).toMatchSnapshot(desc)
    }
})

it('hover on local defined grammar', async () => {
    const hover = new HoverProvider(capabilities)
    const { document, textDocument, markers, program } = File.of`
        <emu-grammar type="definition">
            MoreOneNight :: "more" "one" "night"
        </emu-grammar>
        <emu-clause>
            |MoreOneNight${File.mark('ref')}|
        </emu-clause>
        <emu-grammar>
            MoreOneNight${File.mark('ref in grammar')}
        </emu-grammar>
        <emu-clause>
            MoreOneNight${File.mark('possible ref')}
        </emu-clause>
    `
    for (const { desc, position, around } of markers) {
        const result = await hover.hover(document, program, { textDocument, position })
        expect([around, result]).toMatchSnapshot(desc)
    }
})

it('hover on local defined AO', async () => {
    const hover = new HoverProvider(capabilities)
    const { document, textDocument, markers, program } = File.of`
        <emu-clause id="sec-SaveTheWorld" type="abstract operation">
            <h1>
                SaveTheWorld (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. TODO.
            </emu-alg>
        </emu-clause>
        <emu-alg>
            1. Perform ? SaveThe${File.mark()}World(  ).
        </emu-alg>
    `
    for (const { desc, position, around } of markers) {
        const result = await hover.hover(document, program, { textDocument, position })
        expect([around, result]).toMatchSnapshot(desc)
    }
})
