import {
    type Connection,
    type TextDocuments,
    type ServerCapabilities,
    CompletionItem,
    CompletionItemKind,
    MarkupKind,
} from 'vscode-languageserver'
import type { SourceFile } from '../utils/document.js'
import Fuse from 'fuse.js'
import { biblio, productions } from '../utils/biblio.js'
import type {
    BiblioClause,
    BiblioOp,
    BiblioProduction,
    BiblioTerm,
    SpecOperations,
    SpecValue,
} from '@tc39/ecma262-biblio'

const IsText = /[\w%@|#-_]/
const never: never = undefined!

enum CompletionItemPriority {
    LocalVariable = 'a',

    UsedInDocument = 'z',
    NotUsedInDocument = 'zz',
}
function getPriority(fullText: string, text: string) {
    return fullText.includes(text) ? CompletionItemPriority.UsedInDocument : CompletionItemPriority.NotUsedInDocument
}
export function completionProvider(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
): ServerCapabilities['completionProvider'] {
    const fuse = new Fuse(biblio.entries, {
        // includeScore: true,
        findAllMatches: true,
        keys: [
            { name: 'clause-id', getFn: (f) => (f.type === 'clause' ? f.id : never) },
            { name: 'clause-title', getFn: (f) => (f.type === 'clause' ? f.title : never) },
            { name: 'clause-aoid', getFn: (f) => (f.type === 'clause' ? f.aoid! : never) },
            { name: 'production', getFn: (f) => (f.type === 'production' ? f.name : never) },
            { name: 'term', getFn: (f) => (f.type === 'term' ? f.term : never) },
            { name: 'operation', getFn: (f) => (f.type === 'op' ? f.aoid : never) },
        ],
    })

    connection.onCompletion(async (params, token, workDoneProgress, resultProgress) => {
        const file = documents.get(params.textDocument.uri)
        if (!file) return []

        const fullText = file.text.getText()
        const offset = file.text.offsetAt(params.position)
        const [before, after, all] = findWholeWord(fullText, offset)

        if (!all) return []
        if (before.startsWith('#sec-')) {
            const wholeLine = file.text.getText({
                start: { line: params.position.line, character: 0 },
                end: params.position,
            })
            if (wholeLine.includes('emu-clause')) return []
            const result = fuse
                .search(all.replace('#sec-', ''))
                .map((x) => {
                    if (x.item.type === 'clause') return findReg(x.item, fullText)
                    return null!
                })
                .filter(Boolean)
            return result
        }

        if (before.startsWith('|')) {
            // |something|^
            if (before.length > 1 && before.startsWith('|') && before.endsWith('|')) return []
            // |^ or |^|
            if (all === '|' || all == '||') return productions.map((x) => findProduction(x, true, fullText))
            // |search^item|
            return fuse
                .search({ production: all.replaceAll('|', '') })
                .map((prod) => findProduction(prod.item as BiblioProduction, true, fullText))
        }

        const allCodeBefore = fullText.slice(0, offset)
        if (all.startsWith('_')) return getAllLocalParameters(allCodeBefore, fullText, all, offset)

        const grammarMode = isInGrammarMode(allCodeBefore)
        return {
            isIncomplete: true,
            items: getAllLocalParameters(allCodeBefore, fullText, all, offset).concat(
                fuse.search(grammarMode ? { production: all } : all).flatMap((x) => {
                    if (x.item.type === 'term') return findTerm(x.item, fullText)
                    else if (x.item.type === 'op') return findOperation(x.item, fullText)
                    else if (x.item.type === 'production') return findProduction(x.item, grammarMode, fullText)
                    return []
                }),
            ),
        }
    })
    return {
        triggerCharacters: ['%', '@', '|', '#'],
    }
}

function findReg(entry: BiblioClause, fullText: string): CompletionItem {
    const url = biblio.location + '#' + entry.id
    return {
        label: '#' + entry.id,
        kind: CompletionItemKind.Reference,
        documentation: { kind: MarkupKind.Markdown, value: `${entry.title}\n\n[${url}](${url})` },
        detail: entry.title,
        sortText: getPriority(fullText, entry.id),
    }
}
function findProduction(entry: BiblioProduction, isInGrammarMode: boolean, fullText: string): CompletionItem {
    const url = biblio.location + '#' + entry.id
    return {
        label: entry.name,
        insertText: isInGrammarMode ? entry.name : `|${entry.name}|`,
        detail: entry.name,
        kind: CompletionItemKind.Interface,
        documentation: { kind: MarkupKind.Markdown, value: `[${url}](${url})` },
        sortText: getPriority(fullText, entry.name),
    }
}
function findTerm(entry: BiblioTerm, fullText: string): CompletionItem[] {
    const url =
        entry.refId ? biblio.location + '#' + entry.refId
        : entry.id ? biblio.location + '#' + entry.id
        : undefined
    return (entry.variants?.length ? entry.variants : [entry.term]).map((term) => ({
        label: entry.term.startsWith('@@') ? entry.term.slice(2) : entry.term,
        kind:
            entry.term.startsWith('%') || entry.term.startsWith('@@') ?
                CompletionItemKind.Value
            :   CompletionItemKind.Keyword,
        detail: term,
        documentation: url ? { kind: MarkupKind.Markdown, value: `[${url}](${url})` } : '',
        sortText: getPriority(fullText, entry.term),
    }))
}
function findOperation(entry: BiblioOp, fullText: string): CompletionItem {
    let document = ''
    const url = entry.refId ? biblio.location + '#' + entry.refId : undefined
    if (url) document += `[${url}](${url})`
    if (entry.effects) document += (document.length ? '\n\n' : '') + 'This abstract operation may triggers user code.'
    const signature = formatSignature(entry)
    return {
        label: entry.aoid,
        kind: CompletionItemKind.Function,
        // detail: signature.replaceAll('\n', '').replaceAll(/\s+/g, ' '),
        documentation: {
            kind: MarkupKind.Markdown,
            value: '```ts\n' + signature + '\n```\n\n' + document,
        },
        sortText: getPriority(fullText, entry.aoid),
    }
}
function formatSignature({ aoid, signature }: BiblioOp): string {
    if (!signature) return aoid
    let str = aoid + '('
    if (signature.parameters.length || signature.optionalParameters.length) {
        str += '\n  '
        str += [...signature.parameters, ...signature.optionalParameters]
            .map((x) => formatParameter(x, signature.optionalParameters.includes(x)))
            .join(',\n  ')
        str += '\n'
    }
    str += '): ' + formatSpecValue(signature.return, 0)
    return str
}
function formatParameter(value: SpecOperations.Parameter, optional: boolean): string {
    let str = value.name.slice(1, -1)
    if (optional) str += '?'
    if (value.type) str += ': ' + formatSpecValue(value.type, 2)
    return str
}
function formatSpecValue(value: SpecValue.SpecDataType, identLevel: number): string {
    if (value.kind === 'completion') {
        if (!value.typeOfValueIfNormal) return Cap(value.completionType) + 'Completion'
        return `Completion<${formatSpecValue(value.typeOfValueIfNormal, identLevel)}>`
    } else if (value.kind === 'list') {
        return `List<${formatSpecValue(value.elements, identLevel)}>`
    } else if (value.kind === 'opaque') {
        return value.type
            .replace(/^an? /, '')
            .replace('ECMAScript language value', 'Value')
            .replace('ECMAScript ', '')
            .replace('function object', 'Function')
            .replace(/(\w+) Record/, '$1')
            .replace('*undefined*', 'undefined')
            .replace('property key', 'PropertyKey')
    } else if (value.kind === 'unused') {
        return `unused`
    } else if (value.kind === 'union') {
        return value.types.map(formatSpecValue).join(' | ')
    } else if (value.kind === 'record') {
        return `Record { ${Object.entries(value.fields)
            .map(([key, value]) => `${key}: ${formatSpecValue(value, identLevel)}`)
            .join(', ')} }`
    }
    throw new Error(`Unknown SpecValue: ${JSON.stringify(value)}`)
}
function Cap(x: string): string {
    return x[0]!.toUpperCase() + x.slice(1)
}
function findWholeWord(fullText: string, offset: number): [string, string, string] {
    let from = offset
    let to = offset
    while (from > 0 && IsText.test(fullText[from - 1]!)) from--
    while (to < fullText.length && IsText.test(fullText[to]!)) to++
    return [fullText.slice(from, offset), fullText.slice(offset, to), fullText.slice(from, to)]
}
function isInGrammarMode(beforeText: string) {
    let index = beforeText.lastIndexOf('<emu-grammar')
    if (index === -1) return false
    beforeText = beforeText.slice(index)
    if (beforeText.includes('</emu-grammar>')) return false
    return true
}
function getAllLocalParameters(
    beforeText: string,
    fullText: string,
    wholeWord: string,
    offset: number,
): CompletionItem[] {
    let index = beforeText.lastIndexOf('<emu-alg>')
    if (index === -1) return []
    beforeText = beforeText.slice(index)
    if (beforeText.includes('</emu-alg>')) return []

    const endIndex = fullText.indexOf('</emu-alg>', offset)
    const block = fullText.slice(index, endIndex)
    const vars = block.match(/(_\w+_)/g)
    if (!vars) return []
    const has_Before = wholeWord.startsWith('_')
    const has_After = wholeWord.endsWith('_')
    return [...new Set(vars)].map((x): CompletionItem => {
        const word = x.slice(1, -1)
        return {
            filterText: has_Before ? '_' + word : word,
            label: word,
            insertText: x.slice(0, has_After ? -1 : undefined),
            kind: CompletionItemKind.Variable,
            detail: '(variable) ' + word,
            sortText: CompletionItemPriority.LocalVariable,
        }
    })
}
