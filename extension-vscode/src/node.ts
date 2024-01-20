import { join } from 'path'
import type { ExtensionContext } from 'vscode'
import { LanguageClient, type ServerOptions, TransportKind } from 'vscode-languageclient/node.js'
import { onActivate } from './main.js'

export async function activate(context: ExtensionContext) {
    onActivate(context, (clientOptions) => {
        const isProd = true
        const serverModule = context.asAbsolutePath(
            isProd ?
                join('lib', 'language-server-node.js')
            :   join('node_modules', 'ecmarkup-language-server', 'lib', 'server-node.js'),
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
