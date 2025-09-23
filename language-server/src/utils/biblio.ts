import type { Biblio, BiblioEntry, BiblioOp, BiblioProduction } from '@tc39/ecma262-biblio'
import b from '@tc39/ecma262-biblio' with { type: 'json' }
import type { Connection } from 'vscode-languageserver'
import { wrap_io } from '../io.js'

// TODO: merge the resolved result, in-document > local installed > npm (online) > bundled
export async function resolve_biblio(connection: Connection, doc: string): Promise<Biblio> {
    const io = wrap_io(connection)
    try {
        const json = await io.resolveJSONFile(doc, '@tc39/ecma262-biblio/biblio.json', false)
        if (json) {
            return json as Biblio
        }
    } catch (error) {
        connection.console.warn(`Failed to load local biblio: ${(error as Error).message}`)
    }
    return b
}

export function isProduction(e: BiblioEntry): e is BiblioProduction {
    return e.type === 'production'
}
export function isOp(e: BiblioEntry): e is BiblioOp {
    return e.type === 'op'
}
export function getText(f: BiblioEntry) {
    if (f.type === 'clause') return f.aoid || f.title
    else if (f.type === 'op') return f.aoid
    else if (f.type === 'production') return f.name
    else if (f.type === 'term') return f.term
    return undefined
}

export function getID(entry: BiblioEntry) {
    if (entry.type === 'op') return entry.refId
    else if (entry.type === 'term') return entry.refId || entry.id
    return entry.id
}
// TODO: migrate to not use builtin biblio
export function getURL(entry: BiblioEntry) {
    const id = getID(entry)
    if (!id) return id
    return (b as Biblio).location + '#' + id
}
