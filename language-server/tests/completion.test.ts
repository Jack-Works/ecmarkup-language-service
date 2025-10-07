/// <reference path="../src/biblio.d.ts" />

import { expect, it } from 'vitest'
import type { CompletionItem } from 'vscode-languageserver-types'
import { CompletionItemKind } from 'vscode-languageserver-types'
import { Completion } from '../src/features/completion.js'
import { createProgram } from '../src/workspace/program.js'
import { File, mockClient } from './File.js'

it('complete clauses (#sec-...)', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <a href="${File.mark('suggest')}"></a>
        <a href="#${File.mark('suggest but not replacing children')}">Text</a>
        <a href="https://tc39.es/ecma262/#${File.mark('suggest with host')}">Text</a>
        <a href="#${File.mark('suggest with no end tag')}">
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('suggest clause id (#sec-...)', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <emu-clause id="sec-${File.mark('suggest id: sec-function-properties-of-the-cute-object')}" type="abstract operation">
            <h1>Function properties of the Cute object</h1>
        </emu-clause>

        <emu-clause id="sec-${File.mark('suggest id: sec-myfunction')}" type="abstract operation">
            <h1>MyFunction ( _variable_: an ECMAScript value ): an ECMAScript value or a throw completion</h1>
        </emu-clause>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('complete variables in emu-alg', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <emu-clause id="sec-StartGenshin" type="abstract operation">
            <h1>
                StartGenshin (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Let _result_ be ...
                1. Let _other_ be ...
                1. _${File.mark('variable only')}_
                1. _${File.mark('variable only 2')}
                1. Let ${File.mark('variable only (Let)')}be ...
                1. Set ${File.mark('variable only (Set)')}to ...
            </emu-alg>
        </emu-clause>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(result?.items).toMatchSnapshot(desc)
        expect(sample(result?.items, around)).toMatchSnapshot(`${desc} sample`)
    }

    {
        const completer = new Completion()
        const {
            document,
            textDocument,
            program,
            mark: { position },
        } = File.of`
        <emu-clause id="sec-StartGenshin" type="abstract operation">
            <h1>
                StartGenshin (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Let _result_ be ...
                1. Let _other_ be ...
                1. Let _o${File.mark('should not suggest o')}_
            </emu-alg>
        </emu-clause>
    `

        const result = await completer.complete(document, program, { textDocument, position })
        expect(result!.items.find((item) => item.label === 'o')).toBeFalsy()
    }
})

it('complete grammars', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <emu-grammar type="definition">
            MoreOneNight ::= "more" "one" "night"
        </emu-grammar>
        <emu-grammar>
            ${File.mark('grammar no filter')}
            More${File.mark('grammar')}
        </emu-grammar>
        <emu-prodref name="${
            // TODO: not working yet
            File.mark('emu-prodref')
        }"></emu-prodref>
        <p>|${File.mark('starting trigger char only')}</p>
        <p>|${File.mark('full syntax')}|</p>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(!!result?.items.find((x) => x.label === 'BitwiseANDExpression')).toBe(desc !== 'grammar')
        expect(result?.items.find((x) => x.label === 'MoreOneNight')).toMatchSnapshot(
            `should suggest MoreOneNight (${desc})`,
        )
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('complete intrinsics', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <p>%${File.mark('intrinsic no filter')}%</p>
        <p>%${File.mark('intrinsic no filter no closing')}</p>
        // Note: it's a known problem that VSCode will not respect sortText in the following case and gives a bad completion order.
        <p>%Array.proto${File.mark('intrinsic')}%</p>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(result?.items.find((x) => x.label.includes('Array.proto'))).toMatchSnapshot(
            `should suggest intrinsics (${desc})`,
        )
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('complete well-known symbols', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <p>@@${File.mark('intrinsic no filter')}</p>
        <p>@@iter${File.mark('intrinsic')}</p>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('complete AOs in emu-alg', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <emu-clause id="sec-StartGenshin" type="abstract operation">
            <h1>
                StartGenshin (
                    _input_: an ECMAScript language value,
                ): either a normal completion containing an Object or a throw completion
            </h1>
            <dl class="header">
            </dl>
            <emu-alg>
                1. Let _result_ be ...
                1. Let _other_ be ? ${File.mark('? with space')}
                1. Set _other_ to ?${File.mark('? with no space')}
                1. Set _other_ to ! ${File.mark('! with space')}
                1. Set _other_ to !${File.mark('! with no space')}
                1. Perform ${File.mark('perform')}
                1. Perform ? StartGen${File.mark('local defined AO')}
            </emu-alg>
        </emu-clause>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(result!.items.filter((x) => x.kind === CompletionItemKind.Function).length).toBeGreaterThan(0)
        expect(result!.items.filter((x) => x.kind !== CompletionItemKind.Function).length).toBe(0)
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('completion should take care of the tailing whitespace', async () => {
    const completer = new Completion()
    const { document, textDocument, markers, program } = File.of`
        <emu-alg>
            1. Let _a_ be ....
            Call( _${File.mark('a')} )
        </emu-alg>
    `
    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

it('completion should read local installed biblio', async () => {
    const completer = new Completion()
    const { document, textDocument, markers } = File.of`
        <emu-alg>
            1. ${File.mark()}
        </emu-alg>
    `
    const program = createProgram(
        mockClient({
            async resolveBiblio() {
                return {
                    source: 'mocked',
                    location: 'https://tc39.es/proposal-my-function/',
                    entries: [
                        {
                            type: 'op',
                            aoid: 'MyFunction',
                            effects: [],
                            kind: 'abstract operation',
                            signature: null,
                            refId: 'my-function',
                        },
                    ],
                }
            },
        }),
    )

    for (const { desc, position, around } of markers) {
        const result = await completer.complete(document, program, { textDocument, position })
        expect(sample(result?.items, around)).toMatchSnapshot(desc)
    }
})

function sample(items: readonly CompletionItem[] | undefined = [], around: string) {
    const kinds: Record<string, number> = {}
    const high5 = [...items]
        .sort((a, b) => String(a.sortText || '').localeCompare(b.sortText || ''))
        .slice(0, 5)
        .map((item) => item.label)
    const examples: CompletionItem[] = []
    items.forEach((item) => {
        const kind = item.detail?.match(/\(\w+\)/u)
        if (kind) {
            kinds[kind[0]!] ??= 0
            if (kinds[kind[0]!] === 0) {
                examples.push(item)
            }
            kinds[kind[0]!]! += 1
        }
    })
    return { around, kinds, high5, examples }
}
