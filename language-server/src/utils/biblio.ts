import { createRequire } from 'module'

export function getBiblio(uri: string) {
    const require = createRequire(uri)
    try {
        return require('@tc39/ecma262-biblio')
    } catch {
        return []
    }
}
