import { createRequire } from 'node:module'
import { io_extra } from './general.js'

const io_extra_node: typeof io_extra = {
    resolveBiblio(base) {
        return createRequire(base).resolve('@tc39/ecma262-biblio')
    },
}

export function applyNodeIO() {
    Object.assign(io_extra, io_extra_node)
}
