import type { Biblio, BiblioEntry, BiblioProduction } from '@tc39/ecma262-biblio'
import b from '@tc39/ecma262-biblio' assert { type: 'json' }

export const biblio = b as Biblio
export const productions = biblio.entries.filter(isProduction)

function isProduction(e: BiblioEntry): e is BiblioProduction {
    return e.type === 'production'
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
export function getURL(entry: BiblioEntry) {
    const id = getID(entry)
    if (!id) return id
    return biblio.location + '#' + id
}
