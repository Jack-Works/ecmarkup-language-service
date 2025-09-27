import { createRequire } from 'node:module'
import { io_extra } from './general.js'

const io_extra_node: typeof io_extra = {
    resolve(base, specifier) {
        return createRequire(base).resolve(specifier)
    },
}

export function applyNodeIO() {
    Object.assign(io_extra, io_extra_node)
}
