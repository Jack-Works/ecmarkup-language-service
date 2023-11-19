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
import { findWholeWord } from '../utils/text.js'
import { formatDocument, formatSignature } from '../utils/format.js'

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
    return {
        label: '#' + entry.id,
        kind: CompletionItemKind.Reference,
        documentation: formatDocument(entry)!,
        detail: '(clause) ' + entry.title,
        sortText: getPriority(fullText, entry.id),
    }
}
function findProduction(entry: BiblioProduction, isInGrammarMode: boolean, fullText: string): CompletionItem {
    return {
        label: entry.name,
        insertText: isInGrammarMode ? entry.name : `|${entry.name}|`,
        detail: '(grammar) ' + entry.name,
        kind: CompletionItemKind.Interface,
        documentation: formatDocument(entry)!,
        sortText: getPriority(fullText, entry.name),
    }
}
function findTerm(entry: BiblioTerm, fullText: string): CompletionItem[] {
    return (entry.variants?.length ? entry.variants : [entry.term]).map((term) => ({
        label: entry.term.startsWith('@@') ? entry.term.slice(2) : entry.term,
        kind:
            entry.term.startsWith('%') || entry.term.startsWith('@@') ?
                CompletionItemKind.Value
            :   CompletionItemKind.Keyword,
        detail: '(term) ' + term,
        documentation: formatDocument(entry)!,
        sortText: getPriority(fullText, entry.term),
    }))
}
function findOperation(entry: BiblioOp, fullText: string): CompletionItem {
    return {
        label: entry.aoid,
        kind: CompletionItemKind.Function,
        detail: '(method) ' + entry.aoid,
        documentation: formatDocument(entry)!,
        sortText: getPriority(fullText, entry.aoid),
    }
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
