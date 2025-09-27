import type { BiblioEntry, BiblioOp } from '@tc39/ecma262-biblio'

export function isBiblioOp(entry: BiblioEntry): entry is BiblioOp {
    return entry.type === 'op'
}

export function getText(entry: BiblioEntry) {
    if (entry.type === 'clause') return entry.aoid || entry.title
    else if (entry.type === 'op') return entry.aoid
    else if (entry.type === 'production') return entry.name
    else if (entry.type === 'term') return entry.term
    return undefined
}

export function getID(entry: BiblioEntry) {
    if (entry.type === 'op') return entry.refId
    else if (entry.type === 'term') return entry.refId || entry.id
    return entry.id
}

export function getURL(entry: BiblioEntry) {
    const id = getID(entry)
    if (!id) return undefined
    const location = entry.location ?? 'https://tc39.es/ecma262/'
    return location + '#' + id
}
