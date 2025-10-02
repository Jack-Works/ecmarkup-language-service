import { expect, it } from 'vitest'
import type { Location } from 'vscode-languageserver'
import { ReferenceProvider } from '../src/features/findAllReferences.js'
import type { TextDocument } from '../src/lib.js'
import { betterSnapshot, File } from './File.js'

it('find all references', async () => {
    const goto = new ReferenceProvider()
    const { document, markers, textDocument, program } = File.of`
        <emu-grammar type="definition">
            MoreOne${File.mark('grammar')}Night ::= "more" "one" "night"
        </emu-grammar>
        <emu-prodref name="MoreOneNight"></emu-prodref>
        <p>A |MoreOneNight| production.</p>
        <emu-grammar>
            Other
                MoreOneNight
        </emu-grammar>

        <emu-clause id="sec-SaveTheWorld" type="abstract operation">
            <h1>
                ${File.mark('AO')}SaveTheWorld (
                    _input_${File.mark('parameter')}: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Let _obj_${File.mark('local variable')} be ! OrdinaryObjectCreate(_input_).
                1. Perform ? FinishSavingTheWorld(_obj_).
            </emu-alg>
        </emu-clause>
        <emu-alg>
            1. Perform ? SaveTheWorld(  ).
        </emu-alg>
    `

    for (const { position, desc } of markers) {
        const result = goto.findReferences(document, program, {
            textDocument,
            position,
            context: { includeDeclaration: true },
        })
        expect(printRefs(document, result)).toMatchSnapshot(desc)
    }
})

it('find all references no false positive (containing)', async () => {
    const goto = new ReferenceProvider()
    const { document, markers, textDocument, program } = File.of`
        <emu-clause id="sec-Save" type="abstract operation">
            <h1>
                ${File.mark()}Save (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
            </emu-alg>
        </emu-clause>
        <emu-clause id="sec-SaveTheWorld" type="abstract operation">
            <h1>
                SaveTheWorld (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
            </emu-alg>
        </emu-clause>
        <emu-alg>
            1. Perform ? SaveTheWorld(  ).
        </emu-alg>
    `

    for (const { position, desc } of markers) {
        const result = goto.findReferences(document, program, {
            textDocument,
            position,
            context: { includeDeclaration: true },
        })
        expect(printRefs(document, result)).toMatchSnapshot(desc)
    }
})

it('find all references no false positive (cross AO variable)', async () => {
    const goto = new ReferenceProvider()
    const { document, markers, textDocument, program } = File.of`
        <emu-clause id="sec-Save" type="abstract operation">
            <h1>
                Save (
                    _input_${File.mark()}: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Set _input_ to *undefined*.
            </emu-alg>
        </emu-clause>
        <emu-clause id="sec-SaveTheWorld" type="abstract operation">
            <h1>
                SaveTheWorld (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Set _input_ to *undefined*.
            </emu-alg>
        </emu-clause>
        <emu-alg>
            1. Perform ? SaveTheWorld(  ).
        </emu-alg>
    `

    for (const { position, desc } of markers) {
        const result = goto.findReferences(document, program, {
            textDocument,
            position,
            context: { includeDeclaration: true },
        })
        expect(printRefs(document, result)).toMatchSnapshot(desc)
    }
})

function printRefs(document: TextDocument, tokens: Location[] | undefined) {
    if (tokens === undefined) return 'No reference found'
    return betterSnapshot(
        document,
        tokens.map(({ range }) => ({ annotate: '', range })),
    )
}
