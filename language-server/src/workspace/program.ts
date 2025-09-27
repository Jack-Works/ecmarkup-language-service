import bundledBiblio from '@tc39/ecma262-biblio' with { type: 'json' }
import type { BiblioEntry } from '@tc39/ecma262-biblio'
import type { TextDocument } from 'vscode-html-languageservice'
import { EcmarkupDocument } from '../utils/parse.js'
import { getLanguageModelCache } from '../utils/parseCache.js'
import type { IO } from './io.js'

export interface Program {
    getSourceFile(document: TextDocument): EcmarkupDocument
    onDocumentRemoved(document: TextDocument): void
    dispose(): void

    resolveBiblio(base: string): Promise<readonly BiblioEntry[]>
    warn(...message: unknown[]): Promise<void>
}

export function createProgram(io: IO): Program {
    const fileCache = getLanguageModelCache(10, 60, (doc) => new EcmarkupDocument(doc))
    const biblioCache = new Map<string, Promise<readonly BiblioEntry[]>>()

    return {
        getSourceFile(document) {
            return fileCache.get(document)
        },
        onDocumentRemoved(document) {
            fileCache.onDocumentRemoved(document)
        },
        dispose() {
            fileCache.dispose()
        },
        warn: io.warn,
        resolveBiblio(base) {
            if (biblioCache.has(base)) return biblioCache.get(base)!
            const promise = new Promise<readonly BiblioEntry[]>((resolve, reject) => {
                setTimeout(() => reject('Timeout'), 1000)
                // TODO: validate the external biblio
                io.resolveBiblio(base).then((result) => {
                    if (!result) return resolve(bundledBiblio.entries)
                    const merged: BiblioEntry[] = []
                    const seen = new Set<string>()
                    for (const entry of result.entries) {
                        seen.add(`${entry.type}|${getID(entry)}`)
                        if (result.location !== 'https://tc39.es/ecma262/') {
                            merged.push({ ...entry, source: result.source, location: result.location })
                        }
                    }
                    for (const entry of bundledBiblio.entries) {
                        if (!seen.has(`${entry.type}|${getID(entry)}`)) {
                            merged.push({ ...entry, source: 'bundled' })
                        }
                    }
                    resolve(merged)
                }, reject)
            }).catch((err) => {
                io.warn(`Could not resolve @tc39/ecma262-biblio from ${base}`, err)
                biblioCache.set(base, Promise.resolve(bundledBiblio.entries))
                return bundledBiblio.entries
            })
            biblioCache.set(base, promise)
            return promise
        },
    }
}

function getID(entry: BiblioEntry): string {
    if (entry.type === 'op') return entry.refId || entry.aoid
    else if (entry.type === 'term') return entry.refId || entry.id || entry.term
    return entry.id
}
