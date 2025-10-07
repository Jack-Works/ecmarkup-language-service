import { Uri, window, workspace } from 'vscode'
import type { ClientAPI } from '../../../language-server/src/workspace/io.js'

export const client: ClientAPI = {
    async warn(...message) {
        console.warn(...message)
    },
    async getEditorCursorCount() {
        return window.activeTextEditor?.selections.length ?? 0
    },
    async resolveBiblio(base: string) {
        const candidates: string[] = []
        const specifier = '@tc39/ecma262-biblio/biblio.json'
        const baseUri = Uri.parse(base)
        if (workspace.isTrusted && baseUri.scheme === 'file') {
            try {
                const resolved = io_extra.resolveBiblio(baseUri.fsPath, specifier)
                candidates.push(resolved)
                if (resolved) {
                    const file = await workspace.fs.readFile(Uri.file(resolved))
                    return { ...JSON.parse(new TextDecoder().decode(file)), source: resolved }
                }
            } catch (err) {
                console.error(err, 'resolved candidates:', candidates)
            }
        }

        let try_uri = Uri.joinPath(baseUri, '..')

        while (true) {
            const tryUri = Uri.joinPath(try_uri, './node_modules/', specifier)
            candidates.push(tryUri.fsPath)
            const exist = await Promise.resolve(workspace.fs.readFile(tryUri)).catch(() => undefined)
            try {
                if (exist) {
                    return { ...JSON.parse(new TextDecoder().decode(exist)), source: tryUri.fsPath }
                }
                const next_uri = Uri.joinPath(try_uri, '..')
                if (next_uri.toString() === try_uri.toString()) {
                    throw new Error(
                        `Could not resolve ${specifier} from ${base}. Tried candidates:\n${candidates.join('\n')}`,
                    )
                }
                try_uri = next_uri
            } catch (err) {
                console.error(err, 'resolved candidates:', candidates)
                throw err
            }
        }
    },
}

type FsPath = string

export const io_extra = {
    resolveBiblio(_base: FsPath, _specifier: string): FsPath {
        throw new Error('Not supported on this platform')
    },
}
