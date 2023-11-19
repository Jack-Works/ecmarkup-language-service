import { type Connection, type TextDocuments, type ServerCapabilities, DocumentLink } from 'vscode-languageserver'
import type { SourceFile } from '../utils/document.js'
import { biblio, getID, getText, getURL } from '../utils/biblio.js'
import type { BiblioEntry } from '@tc39/ecma262-biblio'
import { createRange } from '../utils/utils.js'

let RegEx: RegExp
const map = new Map<string, BiblioEntry>()
export function definitionProvider(
    connection: Connection,
    documents: TextDocuments<SourceFile>,
): ServerCapabilities['documentLinkProvider'] {
    connection.onDocumentLinks(async (params, token, workDoneProgress, resultProgress) => {
        RegEx ??= createRegExp()
        const file = documents.get(params.textDocument.uri)
        if (!file) return undefined

        const fullText = file.text.getText()
        const result: DocumentLink[] = []
        for (const _ of fullText.matchAll(RegEx)) {
            const match = _.groups?.['word']!
            const item = map.get(match!)
            if (!item) continue
            const url = getURL(item)
            if (!url) continue
            result.push({
                target: url,
                range: createRange(file.text.positionAt(_.index!), file.text.positionAt(_.index! + match.length)),
                tooltip: `Open ${url}`,
            })
        }
        return result
    })
    return {}
}
function createRegExp(): RegExp {
    const words = []
    for (const item of biblio.entries) {
        const text = getText(item)
        if (text) {
            const escaped = escapeRegEx(text)
            words.push(escaped)
            map.set(escaped, item)
        }
        const id = getID(item)
        if (id) {
            const escaped = '#' + escapeRegEx(id)
            words.push(escaped)
            map.set(escaped, item)
        }
    }
    words.sort((a, b) => b.length - a.length)
    return new RegExp(`\\b(?<word>${words.join('|')})\\b`, 'g')
}
function escapeRegEx(x: string) {
    return x
        .replaceAll(/\(.+/g, '')
        .replaceAll('[', '\\[')
        .replaceAll(']', '\\]')
        .replaceAll('.', '\\.')
        .replaceAll('+', '\\+')
        .trim()
}
