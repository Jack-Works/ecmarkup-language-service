import { join } from 'path'
import type { ExtensionContext } from 'vscode'
import { LanguageClient, type ServerOptions, TransportKind } from 'vscode-languageclient/node.js'
import { onActivate } from './main'

export async function activate(context: ExtensionContext) {
    onActivate(context, (clientOptions) => {
        const serverModule = context.asAbsolutePath(
            process.env.NODE_ENV === 'production'
                ? join('lib', 'language-server-node.js')
                : join('node_modules', 'ecmarkup-language-server', 'lib', 'server-node.js')
        )
        const serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: {
                module: serverModule,
                transport: TransportKind.ipc,
                options: { execArgv: process.env.NODE_ENV === 'production' ? [] : ['--nolazy', '--inspect=29384'] },
            },
        }
        return new LanguageClient(
            'ecmarkup.language.service',
            'ecmarkup language service',
            serverOptions,
            clientOptions
        )
    })
}
export { onDeactivate as deactivate } from './main'
