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
    BiblioEntry,
    BiblioOp,
    BiblioProduction,
    BiblioTerm,
    SpecOperations,
    SpecValue,
} from '@tc39/ecma262-biblio'
import { findWholeWord } from '../utils/text.js'
import { formatDocument } from '../utils/format.js'

export function hoverProvider(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
): ServerCapabilities['hoverProvider'] {
    connection.onHover(async (params, token, workDoneProgress, resultProgress) => {
        const file = documents.get(params.textDocument.uri)
        if (!file) return undefined

        const fullText = file.text.getText()
        const offset = file.text.offsetAt(params.position)
        let [before, after, all] = findWholeWord(fullText, offset)
        if (all.startsWith('|') && all.endsWith('|')) all = all.slice(1, -1)

        const item = biblio.entries.find(findWord(all))
        if (!item) return
        const contents = formatDocument(item)
        if (!contents) return undefined
        return { contents }
    })
    return {}
}
function findWord(word: string) {
    return (f: BiblioEntry): boolean => {
        if (f.type === 'clause') return f.aoid === word || f.title === word
        else if (f.type === 'op') return f.aoid === word
        else if (f.type === 'production') return f.name === word
        else if (f.type === 'term') return f.term === word
        return false
    }
}
