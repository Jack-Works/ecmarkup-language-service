// @ts-check
/// <reference path="../../language-server/src/biblio.d.ts" />
import biblio from '@tc39/ecma262-biblio' with { type: 'json' }
// op, term, table, clause, production, step, figure, note

import { readFile, writeFile } from 'node:fs/promises'
import YAML from 'js-yaml'

const aoid =
    '\\b(' +
    biblio.entries
        .map((x) => x.type === 'op' && x.aoid)
        .filter(Boolean)
        .join('|') +
    ')\\b'
const term =
    '\\b(' +
    biblio.entries
        .map((x) => x.type === 'term' && x.term)
        .filter(Boolean)
        .filter((x) => !x.match(/%.+%/) && !x.startsWith('@@'))
        .map((x) => ` ${x} `)
        .join('|') +
    ')\\b'

await transform(
    new URL('../syntaxes/ecmarkdown.tmLanguage.yaml', import.meta.url),
    new URL('../syntaxes/ecmarkdown.tmLanguage.json', import.meta.url),
    (data) => data.replace(/  aoid: .+/, `  aoid: ${aoid}`).replace(/  term: .+/, `  term: ${term}`)
)
await transform(
    new URL('../syntaxes/grammarkdown.tmLanguage.yaml', import.meta.url),
    new URL('../syntaxes/grammarkdown.tmLanguage.json', import.meta.url)
)

/**
 * @param {URL} input
 * @param {URL} output
 * @param {(x: string) => string} [transformer]
 */
async function transform(input, output, transformer = (x) => x) {
    const file = await readFile(input, 'utf8')
    await writeFile(output, generateJSON(transformer(file)))
}

/**
 * Copied from https://www.jsdelivr.com/package/npm/com.matheusds365.vscode.yamlsyntax2json
 */
function generateJSON(file) {
    const variables = new Map()
    const parsedInput = YAML.load(file)
    const output = {}
    parseVariables()
    output['$schema'] = parsedInput['$schema']
    output['name'] = parsedInput['name']
    output['scopeName'] = parsedInput['scopeName']
    if (typeof parsedInput['foldingStartMarker'] == 'string')
        output['foldingStartMarker'] = applyRegExpVariables(parsedInput['foldingStartMarker'])
    if (typeof parsedInput['foldingStopMarker'] == 'string')
        output['foldingStopMarker'] = applyRegExpVariables(parsedInput['foldingStopMarker'])
    if (typeof parsedInput['firstLineMatch'] == 'string')
        output['firstLineMatch'] = applyRegExpVariables(parsedInput['firstLineMatch'])
    let origRules = parsedInput['patterns']
    output['patterns'] = origRules instanceof Array ? origRules.map((p) => parseRule(p)) : null
    let origRepository = parsedInput['repository']
    output['repository'] = typeof origRepository == 'object' ? parseRepository(origRepository) : {}
    return JSON.stringify(output, null, 4)

    function parseVariables() {
        const vars = parsedInput.variables
        for (let name in vars) {
            variables.set(name, applyRegExpVariables(String(vars[name])))
        }
    }

    function parseRepository(orig) {
        let r = {}
        for (let k in orig) {
            let origR = orig[k]
            if (typeof origR != 'object') {
                continue
            }
            r[k] = parseRule(origR)
        }
        return r
    }

    function parseRule(orig) {
        let r = {
            ['name']: orig.name,
        }
        if (typeof orig['match'] == 'string') r['match'] = applyRegExpVariables(orig['match'])
        if (typeof orig['begin'] == 'string') r['begin'] = applyRegExpVariables(orig['begin'])
        if (typeof orig['end'] == 'string') r['end'] = applyRegExpVariables(orig['end'])
        if (orig['patterns'] instanceof Array) r['patterns'] = orig['patterns'].map((r) => parseRule(r))
        if (typeof orig['contentName'] == 'string') r['contentName'] = orig['contentName']
        if (typeof orig['include'] == 'string') r['include'] = orig['include']
        if (typeof orig['captures'] == 'object') r['captures'] = orig['captures']
        if (typeof orig['beginCaptures'] == 'object') r['beginCaptures'] = orig['beginCaptures']
        if (typeof orig['endCaptures'] == 'object') r['endCaptures'] = orig['endCaptures']
        return r
    }

    function applyRegExpVariables(r) {
        return r.replace(/\{\{([a-zA-Z0-9_\-\$]+)\}\}/g, (_, s) => {
            let replacement = variables.get(s)
            if (replacement === undefined) {
                console.error(`Undefined variable: ${s}`)
                replacement = ''
            }
            return replacement
        })
    }
}
