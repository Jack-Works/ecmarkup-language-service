import { Uri, window, workspace } from 'vscode'
import type { IO } from '../../../language-server/src/workspace/io.js'

export const io: IO = {
    async warn(...message) {
        console.warn(...message)
    },
    async getEditorCursorCount() {
        return window.activeTextEditor?.selections.length ?? 0
    },
    async resolveBiblio(base: string) {
        const specifier = '@tc39/ecma262-biblio/biblio.json'
        const baseUri = Uri.parse(base)
        if (workspace.isTrusted && baseUri.scheme === 'file') {
            try {
                const resolved = io_extra.resolve(baseUri.fsPath, specifier)
                if (resolved) {
                    const file = await workspace.fs.readFile(Uri.file(resolved))
                    return { ...JSON.parse(new TextDecoder().decode(file)), source: resolved }
                }
            } catch (err) {
                console.error(err)
            }
        }

        let try_uri = Uri.joinPath(baseUri, '..')

        while (true) {
            const tryUri = Uri.joinPath(try_uri, './node_modules/', specifier)
            const exist = await Promise.resolve(workspace.fs.readFile(tryUri)).catch(() => undefined)
            if (exist) {
                return { ...JSON.parse(new TextDecoder().decode(exist)), source: tryUri.fsPath }
            }
            const next_uri = Uri.joinPath(try_uri, '..')
            if (next_uri.toString() === try_uri.toString()) {
                throw new Error(`Could not resolve ${specifier} from ${base}`)
            }
            try_uri = next_uri
        }
    },
}

type FsPath = string

export const io_extra = {
    resolve(_base: FsPath, _specifier: string): FsPath {
        throw new Error('Not supported on this platform')
    },
}
