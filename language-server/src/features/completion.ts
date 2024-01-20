import {
    type Connection,
    type TextDocuments,
    type ServerCapabilities,
    CompletionItem,
    CompletionItemKind,
} from 'vscode-languageserver'
import { TextDocument } from '../lib.js'
import Fuse, { type FuseResult } from 'fuse.js'
import { biblio, productions } from '../utils/biblio.js'
import type { BiblioClause, BiblioOp, BiblioProduction, BiblioTerm } from '@tc39/ecma262-biblio'
import { expandWord } from '../utils/text.js'
import { formatDocument, type MaybeLocalEntry } from '../utils/format.js'
import { EcmarkupDocument, getSourceFile } from '../utils/parse.js'

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
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['completionProvider']> {
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
        const document = documents.get(params.textDocument.uri)
        if (!document) return []
        const sourceFile = getSourceFile.get(document)
        const fullText = document.getText()
        const offset = document.offsetAt(params.position)

        let { isHash, isGrammar, isGrammarLeading, isVariableLeading, word, isWellKnownSymbol, isIntrinsicLeading } =
            expandWord(fullText, offset)

        if (isHash) {
            const wholeLine = document.getText({
                start: { line: params.position.line, character: 0 },
                end: params.position,
            })
            if (wholeLine.includes('emu-clause')) return []
            const searchWord = word.replace('sec-', '')
            if (!searchWord)
                return biblio.entries
                    .filter((x): x is BiblioClause => x.type === 'clause')
                    .map((x) => findReference(x, fullText))
            const result = fuse
                .search(searchWord)
                .filter((x): x is FuseResult<BiblioClause> => x.item.type === 'clause')
                .map(({ item }) => findReference(item, fullText))
            return result
        }

        const node = sourceFile.findNodeAt(offset)
        const inGrammarTag = node.tag === 'emu-grammar'

        if (isVariableLeading) return findVariables(sourceFile, word, offset)

        fuse.setCollection([
            ...biblio.entries,
            ...sourceFile
                .getLocalDefinedGrammars()
                .map(
                    (name): MaybeLocalEntry<BiblioProduction> => ({ id: name, name, type: 'production', local: true }),
                ),
        ])

        if ((isGrammarLeading || inGrammarTag) && word === '') {
            // |^ or |^| when not in emu-grammar
            const completionMode = isGrammar || inGrammarTag ? 'no' : 'end'
            return productions.map((x) => findProduction(x, completionMode, fullText))
        }
        if (isGrammarLeading) {
            const completionMode = isGrammar ? 'no' : 'end'
            // |search^item|
            return fuse
                .search({ production: word })
                .map((prod) => findProduction(prod.item as BiblioProduction, completionMode, fullText))
        } else if (isIntrinsicLeading) word = '%' + word
        else if (isWellKnownSymbol) word = '@@' + word

        return {
            isIncomplete: true,
            items: findVariables(sourceFile, word, offset).concat(
                fuse.search(inGrammarTag ? { production: word } : word).flatMap((x) => {
                    if (x.item.type === 'term') return findTerm(x.item, fullText)
                    else if (x.item.type === 'op') return findOperation(x.item, fullText)
                    else if (x.item.type === 'production') return findProduction(x.item, 'both', fullText)
                    return []
                }),
            ),
        }
    })
    return {
        triggerCharacters: ['%', '@', '|', '#'],
    }
}

function findReference(entry: BiblioClause, fullText: string): CompletionItem {
    return {
        label: '#' + entry.id,
        kind: CompletionItemKind.Reference,
        documentation: formatDocument(entry)!,
        detail: '(clause) ' + entry.title,
        sortText: getPriority(fullText, entry.id),
    }
}
function findProduction(
    entry: MaybeLocalEntry<BiblioProduction>,
    grammarMode: 'both' | 'end' | 'no',
    fullText: string,
): CompletionItem {
    return {
        label: entry.name,
        insertText:
            grammarMode === 'both' ? `|${entry.name}|`
            : grammarMode === 'end' ? entry.name + '|'
            : entry.name,
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
function findVariables(ecmarkup: EcmarkupDocument, word: string, offset: number): CompletionItem[] {
    const nodeText = ecmarkup.getNodeText(ecmarkup.findNodeAt(offset))
    const headerText = ecmarkup.getNodeText(ecmarkup.getAlgHeader(offset))

    const vars = (headerText + nodeText).match(/(_\w+_)/g)
    const has_Before = word.startsWith('_')
    const has_After = word.endsWith('_')
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
