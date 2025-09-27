import type { BiblioClause, BiblioEntry, BiblioOp, BiblioProduction, BiblioTerm } from '@tc39/ecma262-biblio'
import Fuse, { type FuseResult } from 'fuse.js'
import {
    type CancellationToken,
    type CompletionClientCapabilities,
    type CompletionItem,
    CompletionItemKind,
    type CompletionList,
    type CompletionParams,
    type Connection,
    InsertTextFormat,
    Range,
    type ResultProgressReporter,
    type ServerCapabilities,
    type TextDocuments,
    TextEdit,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { formatDocument } from '../utils/format.js'
import type { EcmarkupDocument } from '../utils/parse.js'
import { word_at_cursor } from '../utils/text.js'
import type { Program } from '../workspace/program.js'

const never: never = undefined!

export function completionProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
    capabilities: CompletionClientCapabilities | undefined,
): NonNullable<ServerCapabilities['completionProvider']> {
    const completer = new Completer(capabilities)
    connection.onCompletion(completer.handler(program, documents))
    return { triggerCharacters: ['%', '@', '|', '#', '?', '!', '_'] }
}

export class Completer {
    constructor(public feature: CompletionClientCapabilities = { completionItem: { snippetSupport: true } }) {
        this.supportSnippet = this.feature?.completionItem?.snippetSupport ?? false
    }
    supportSnippet
    fuse: Fuse<BiblioEntry> = new Fuse([] as BiblioEntry[], {
        includeScore: true,
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

    async complete(
        document: TextDocument,
        program: Program,
        params: CompletionParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
        _resultProgress?: ResultProgressReporter<CompletionItem[]> | undefined,
    ): Promise<CompletionList | undefined | null> {
        const sourceFile = program.getSourceFile(document)
        const biblio = await program.resolveBiblio(document.uri)
        this.fuse.setCollection(biblio)

        const fullText = document.getText()
        const cursorAt = document.offsetAt(params.position)
        const node = sourceFile.findNodeAt(cursorAt)

        const {
            leftBoundary,
            rightBoundary,
            isHash,
            isGrammar,
            isIntrinsic,
            isVariable,
            isGrammarLeading,
            isVariableLeading,
            isCall,
            word,
            isWellKnownSymbol,
            isIntrinsicLeading,
            leadingContextWord,
        } = word_at_cursor(fullText, cursorAt)

        // try to match <a href="...
        const noWhiteSpaceAfter = fullText[rightBoundary + (isGrammar || isIntrinsic || isVariable ? 1 : 0)] === ' '
        const is_in_href_of_a_tag =
            node.tag === 'a' &&
            (node.startTagEnd ? cursorAt < node.startTagEnd : true) &&
            fullText.slice(node.start, cursorAt).match(/href\s*=\s*["']?([^"']*)$/gimu)

        // TODO: complete local defined ids
        if (isHash || is_in_href_of_a_tag) {
            let insertTitle: Range | undefined
            if (
                is_in_href_of_a_tag &&
                node.startTagEnd &&
                // only replace title when the <a> tag is empty
                (node.endTagStart ? !fullText.slice(node.startTagEnd, node.endTagStart).trim().length : true)
            ) {
                insertTitle = Range.create(
                    sourceFile.text.positionAt(node.startTagEnd),
                    sourceFile.text.positionAt(node.endTagStart || node.startTagEnd),
                )
            }
            const search = word.replace('sec-', '')
            const currentLine = document.getText({
                start: { line: params.position.line, character: 0 },
                end: { line: params.position.line + 1, character: 0 },
            })
            const currentLineBeforeCursor = currentLine.slice(0, params.position.character)
            const insertHost = !currentLineBeforeCursor.match(/\/\/\S*$/gmu)
            const items: CompletionItem[] = this.search_entry(biblio, search)
                .filter((entry): entry is FuseResult<BiblioClause> => entry.item.type === 'clause')
                .map(({ item, score = 0 }) => completeClause(item, insertHost, insertTitle, score))
            return { isIncomplete: false, items }
        }

        // try to match <emu-clause id="...
        const is_in_id_of_emu_clause_tag =
            node.tag === 'emu-clause' &&
            node.startTagEnd &&
            node.endTagStart &&
            cursorAt > node.start &&
            cursorAt < node.startTagEnd &&
            fullText.slice(node.start, cursorAt).match(/id\s*=\s*["']?([^"']*)$/gmu)
        // ... and complete the id according to the <h1> content
        if (is_in_id_of_emu_clause_tag) {
            const h1 = node.children.find((node) => node.tag === 'h1')
            if (h1?.startTagEnd && h1.endTagStart) {
                const title = fullText.slice(h1.startTagEnd, h1.endTagStart).trim().split('(')[0]!
                const suggestedId =
                    'sec-' +
                    title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                // To workaround the conflict with the snippet
                if ((await program.getEditorCursorCount().catch(() => 1)) > 1) {
                    return { isIncomplete: false, items: [] }
                }
                return {
                    isIncomplete: false,
                    items: [{ label: suggestedId, kind: CompletionItemKind.Reference }],
                }
            }
        }

        // complete %...%
        if (isIntrinsicLeading) {
            const replaceRange = Range.create(
                document.positionAt(leftBoundary - 1),
                document.positionAt(isIntrinsic ? rightBoundary + 1 : rightBoundary),
            )
            const items: CompletionItem[] = this.search_entry(biblio, word)
                .filter(
                    (entry): entry is FuseResult<BiblioTerm> =>
                        entry.item.type === 'term' && entry.item.term.startsWith('%'),
                )
                .flatMap(({ item, score = 0 }) => completeTerm(item, score, false, replaceRange, noWhiteSpaceAfter))
            return { isIncomplete: false, items }
        }

        // complete @@...
        if (isWellKnownSymbol) {
            const range = Range.create(document.positionAt(leftBoundary - 2), document.positionAt(leftBoundary))
            const items: CompletionItem[] = this.search_entry(biblio, word)
                .filter(
                    (entry): entry is FuseResult<BiblioTerm> =>
                        entry.item.type === 'term' && entry.item.term.startsWith('%Symbol.'),
                )
                .flatMap(({ item, score = 0 }) => completeTerm(item, score, true, range, noWhiteSpaceAfter))
            return { isIncomplete: true, items }
        }

        const collection: BiblioEntry[] = [
            ...biblio,
            ...sourceFile.localDefinedGrammars.map(
                (define): BiblioProduction => ({
                    id: define.name,
                    name: define.name,
                    type: 'production',
                    local: true,
                }),
            ),
            ...sourceFile.localDefinedAbstractOperations.map(
                (define): BiblioOp => ({
                    type: 'op',
                    aoid: define.name,
                    effects: [],
                    kind: 'abstract operation',
                    refId: undefined,
                    signature: null,
                    local: true,
                }),
            ),
        ]
        this.fuse.setCollection(collection)

        // complete abstract operations
        if (
            node.tag === 'emu-alg' &&
            (isCall || leadingContextWord === 'perform' || leadingContextWord === '?' || leadingContextWord === '!')
        ) {
            const prefixWith = isCall ? fullText[leftBoundary - 1] : undefined
            const replaceRange = isCall
                ? Range.create(document.positionAt(leftBoundary - 1), document.positionAt(leftBoundary))
                : undefined
            const items: CompletionItem[] = this.search_entry(collection, word)
                .filter((entry): entry is FuseResult<BiblioOp> => entry.item.type === 'op')
                .map(({ item, score = 0 }) =>
                    completeAbstractOperation(
                        item,
                        score,
                        this.supportSnippet,
                        prefixWith as '?' | '!' | undefined,
                        replaceRange,
                    ),
                )
            return { isIncomplete: false, items }
        }

        const inGrammarTag = node.tag === 'emu-grammar'
        // complete variables
        if (isVariableLeading || (!inGrammarTag && (leadingContextWord === 'set' || leadingContextWord === 'let'))) {
            const replaceRange = isVariableLeading
                ? Range.create(
                      document.positionAt(leftBoundary - 1),
                      document.positionAt(isVariable ? rightBoundary + 1 : rightBoundary),
                  )
                : undefined
            const items = completeVariables(
                sourceFile,
                isVariableLeading,
                cursorAt,
                word,
                replaceRange,
                // in case of "Set 🔽to ...", the noWhiteSpaceAfter is refer to the space after "to"
                leadingContextWord ? fullText[cursorAt] === ' ' : noWhiteSpaceAfter,
            )
            return { isIncomplete: false, items }
        }

        // completes grammar productions
        if (isGrammarLeading || inGrammarTag) {
            const replaceRange = inGrammarTag
                ? undefined
                : Range.create(
                      document.positionAt(leftBoundary - 1),
                      document.positionAt(isGrammar ? rightBoundary + 1 : rightBoundary),
                  )
            const items = this.search_entry(collection, word ? { production: word } : undefined)
                .filter(({ item }) => item.type === 'production')
                .map(({ item, score = 0 }) => {
                    const entry = item as BiblioProduction
                    return completeProduction(
                        entry,
                        inGrammarTag,
                        !word ? ('local' in entry ? 0.1 : 0.2) : score,
                        replaceRange,
                        noWhiteSpaceAfter,
                    )
                })
            return { isIncomplete: false, items }
        }

        // complete everything else
        const items = completeVariables(
            sourceFile,
            isVariableLeading,
            cursorAt,
            '',
            undefined,
            noWhiteSpaceAfter,
        ).concat(
            this.search_entry(collection, word).flatMap(({ item, score = 0 }) => {
                if (item.type === 'term') return completeTerm(item, score, false, undefined, noWhiteSpaceAfter)
                else if (item.type === 'op')
                    return completeAbstractOperation(item, score, this.supportSnippet, undefined, undefined)
                else if (item.type === 'production')
                    return completeProduction(item, inGrammarTag, score, undefined, noWhiteSpaceAfter)
                return []
            }),
        )
        return { isIncomplete: true, items }
    }

    search_entry(
        biblio: readonly BiblioEntry[],
        word: string | object | undefined,
    ): Pick<FuseResult<BiblioEntry>, 'item' | 'score'>[] {
        if (word) {
            return this.fuse.search(word)
        } else {
            return biblio.map((item) => ({ item }))
        }
    }

    handler(program: Program, documents: TextDocuments<TextDocument>) {
        return (
            params: CompletionParams,
            _token?: CancellationToken,
            _workDoneProgress?: WorkDoneProgressReporter,
            _resultProgress?: ResultProgressReporter<CompletionItem[]> | undefined,
        ) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return []
            return this.complete(document, program, params, _token, _workDoneProgress, _resultProgress)
        }
    }
}

/**
 * @param entry The matched entry
 * @param insertHost If insert the host domain (https://tc39.es/ecma262/) before the #
 * @param insertTitle The range to be replaced with the clause title
 * @param score Match score
 */
function completeClause(
    entry: BiblioClause,
    insertHost: boolean,
    insertTitle: Range | undefined,
    score: number,
): CompletionItem {
    return {
        label: '#' + entry.id,
        insertText: (insertHost ? entry.location || 'https://tc39.es/ecma262/' : '') + '#' + entry.id,
        additionalTextEdits: insertTitle ? [{ newText: entry.title.split('(')[0]!.trim(), range: insertTitle }] : [],
        kind: CompletionItemKind.Reference,
        documentation: formatDocument(entry)!,
        detail: '(clause) ' + entry.title,
        sortText: score.toString(),
    }
}

/**
 * @param entry The matched entry
 * @param inGrammarTag If the completion is triggered inside a <emu-grammar> tag
 * @param score Match score
 * @param replaceRange Replace range when applies the match
 * @param noWhiteSpaceAfter If the insertText need a white space after it
 */
function completeProduction(
    entry: BiblioProduction,
    inGrammarTag: boolean,
    score: number,
    replaceRange: Range | undefined,
    noWhiteSpaceAfter: boolean,
): CompletionItem {
    const insertText = inGrammarTag ? entry.name : `|${entry.name}|`

    return {
        label: entry.name,
        detail: '(grammar) ' + entry.name,
        filterText: insertText,
        kind: CompletionItemKind.Interface,
        documentation: formatDocument(entry)!,
        sortText: score.toString(),

        textEdit: replaceRange ? TextEdit.replace(replaceRange, suffixSpace(insertText, noWhiteSpaceAfter)) : never,
        insertText: !replaceRange ? suffixSpace(insertText, noWhiteSpaceAfter) : never,
    }
}

/**
 * @param entry The matched entry
 * @param score Match score
 * @param isWellKnownSymbol If the completion is for a well-known symbol (starts with @@)
 * @param replaceRange Replace range when applies the match
 * @param noWhiteSpaceAfter If the insertText need a white space after it
 */
function completeTerm(
    entry: BiblioTerm,
    score: number,
    isWellKnownSymbol: boolean,
    replaceRange: Range | undefined,
    noWhiteSpaceAfter: boolean,
): CompletionItem[] {
    return (entry.variants?.length ? entry.variants : [entry.term]).map((term): CompletionItem => {
        return {
            label: entry.term,
            kind: entry.term.startsWith('%') ? CompletionItemKind.Value : CompletionItemKind.Keyword,
            filterText: isWellKnownSymbol ? '@@' + term.slice(1, -1) : never,
            detail: '(term) ' + term,
            documentation: formatDocument(entry)!,
            sortText: score.toString(),

            textEdit: replaceRange ? TextEdit.replace(replaceRange, suffixSpace(term, noWhiteSpaceAfter)) : never,
            insertText: !replaceRange ? suffixSpace(entry.term, noWhiteSpaceAfter) : never,
        }
    })
} /**
 * @param entry The matched entry
 * @param score Match score
 * @param supportSnippet If the client supports snippets
 * @param prefixWith ? or !
 * @param replaceRange Replace range when applies the match
 */
function completeAbstractOperation(
    entry: BiblioOp,
    score: number,
    supportSnippet: boolean,
    prefixWith: '?' | '!' | undefined,
    replaceRange: Range | undefined,
): CompletionItem {
    // Note: do not simplify to insertText only, vscode does not act consistently with prefixing with ? and !.
    const call = supportSnippet ? '( $1 )' : '( )'
    const insertText = prefixWith ? `${prefixWith} ${entry.aoid}${call}` : `${entry.aoid}${call}`
    return {
        label: entry.aoid,
        kind: CompletionItemKind.Function,
        detail: '(method) ' + entry.aoid,
        documentation: formatDocument(entry)!,
        sortText: score.toString(),
        filterText: prefixWith ? prefixWith + entry.aoid : never,
        commitCharacters: ['('],
        insertTextFormat: supportSnippet ? InsertTextFormat.Snippet : never,

        textEdit: replaceRange ? TextEdit.replace(replaceRange, insertText) : never,
        insertText: !replaceRange ? insertText : never,
    }
}

/**
 * This will only complete variables in the current <emu-alg> and its header.
 * @param ecmarkup The parsed EcmarkupDocument
 * @param isVariableLeading If the cursor has a leading "_"
 * @param cursorOffset The offset within the document
 * @param excludeWord The variable name to exclude
 * @param replaceRange Replace range when applies the match
 * @param noWhiteSpaceAfter If the insertText need a white space after it
 */
function completeVariables(
    ecmarkup: EcmarkupDocument,
    isVariableLeading: boolean,
    cursorOffset: number,
    excludeWord: string,
    replaceRange: Range | undefined,
    noWhiteSpaceAfter: boolean,
): CompletionItem[] {
    const nodeText = ecmarkup.getNodeText(ecmarkup.findNodeAt(cursorOffset))
    const headerText = ecmarkup.getNodeText(ecmarkup.getAlgHeader(cursorOffset))

    const variables = (headerText + nodeText).match(/(_\w+_)/g)
    const variables_deduplicated = new Set(variables)
    variables_deduplicated.delete(`_${excludeWord}_`)

    return [...variables_deduplicated].map((variable): CompletionItem => {
        const variable_name = variable.slice(1, -1)
        return {
            filterText: isVariableLeading ? '_' + variable_name : variable_name,
            label: variable_name,
            kind: CompletionItemKind.Variable,
            detail: '(variable) ' + variable_name,
            sortText: '0',

            textEdit: replaceRange ? TextEdit.replace(replaceRange, suffixSpace(variable, noWhiteSpaceAfter)) : never,
            insertText: !replaceRange ? suffixSpace(variable, noWhiteSpaceAfter) : never,
        }
    })
}
function suffixSpace(str: string, noSpace: boolean) {
    return noSpace ? str : str + ' '
}
