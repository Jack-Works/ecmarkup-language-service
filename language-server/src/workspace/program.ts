import bundledBiblio from '@tc39/ecma262-biblio' with { type: 'json' }
import type { BiblioEntry } from '@tc39/ecma262-biblio'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getLanguageModelCache } from '../parser/cache.js'
import { EcmarkupDocument } from '../parser/ecmarkup.js'
import type { ClientAPI } from './io.js'

export interface Program {
    getSourceFile(document: TextDocument): EcmarkupDocument
    onDocumentRemoved(document: TextDocument): void
    dispose(): void

    resolveBiblio(base: string): Promise<readonly BiblioEntry[]>
    resolveEcma262Source(base: string): Promise<EcmarkupDocument | undefined>
    resetEcma262Source(): void
    getEditorCursorCount(): Promise<number>
    warn(...message: unknown[]): Promise<void>
}

export function createProgram(client: ClientAPI): Program {
    const fileCache = getLanguageModelCache(10, 60, (doc) => new EcmarkupDocument(doc))
    const biblioCache = new Map<string, Promise<readonly BiblioEntry[]>>()
    let ecma262Source: Promise<EcmarkupDocument | undefined> | undefined

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
        resolveEcma262Source(base) {
            if (ecma262Source) return ecma262Source
            ecma262Source = client
                .resolveEcma262Source(base)
                .then((source) => {
                    if (!source) return undefined
                    const document = TextDocument.create(source.uri, 'ecmarkup', 0, source.text)
                    return new EcmarkupDocument(document)
                })
                .catch((err) => {
                    client.warn(`Could not resolve the local ECMA-262 repository from ${base}`, err)
                    return undefined
                })
            return ecma262Source
        },
        resetEcma262Source() {
            ecma262Source = undefined
        },
        warn: client.warn,
        getEditorCursorCount: client.getEditorCursorCount,
        resolveBiblio(base) {
            if (biblioCache.has(base)) return biblioCache.get(base)!
            const promise = new Promise<readonly BiblioEntry[]>((resolve, reject) => {
                setTimeout(() => reject('Timeout'), 1000)
                // TODO: validate the external biblio
                client.resolveBiblio(base).then((result) => {
                    if (!result) return resolve(bundledBiblio.entries)
                    const merged: BiblioEntry[] = []
                    const seen = new Set<string>()
                    for (const entry of result.entries) {
                        seen.add(`${entry.type}|${getID(entry)}`)
                        if (result.location !== 'https://tc39.es/ecma262/') {
                            merged.push({ ...entry, source: result.source, location: result.location })
                        } else {
                            merged.push({ ...entry, source: result.source })
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
                client.warn(`Could not resolve @tc39/ecma262-biblio from ${base}`, err)
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
