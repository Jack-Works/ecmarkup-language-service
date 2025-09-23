import { join } from 'node:path'
import type { ExtensionContext } from 'vscode'
import { LanguageClient, type ServerOptions, TransportKind } from 'vscode-languageclient/node.js'
import { onActivate } from './main.js'
import { io_extra } from './io.js'
import { createRequire } from 'node:module'

const io_extra_node: typeof io_extra = {
    resolve(base, specifier) {
        return createRequire(base).resolve(specifier)
    },
}
Object.assign(io_extra, io_extra_node)

export async function activate(context: ExtensionContext) {
    onActivate(context, (clientOptions) => {
        const isProd = false
        const serverModule = context.asAbsolutePath(
            isProd
                ? join('lib', 'language-server-node.js')
                : join('node_modules', 'ecmarkup-language-server', 'lib', 'server-node.js'),
        )
        const serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: {
                module: serverModule,
                transport: TransportKind.ipc,
                options: { execArgv: isProd ? [] : ['--nolazy', '--inspect=29381'] },
            },
        }
        return new LanguageClient(
            'ecmarkup.language.service',
            'ecmarkup language service',
            serverOptions,
            clientOptions,
        )
    })
}
export { onDeactivate as deactivate } from './main.js'
