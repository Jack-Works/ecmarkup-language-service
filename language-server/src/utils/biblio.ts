import type { Biblio, BiblioEntry, BiblioProduction } from '@tc39/ecma262-biblio'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
export const biblio = require('@tc39/ecma262-biblio') as Biblio
export const productions = biblio.entries.filter(isProduction)

function isProduction(e: BiblioEntry): e is BiblioProduction {
    return e.type === 'production'
}
