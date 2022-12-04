import * as path from 'path'
import { commands, extensions, workspace, type ExtensionContext } from 'vscode'
import {
    LanguageClient,
    type LanguageClientOptions,
    type ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node.js'

let client: LanguageClient
export async function activate(context: ExtensionContext) {
    // See: https://github.com/microsoft/vscode/issues/160585
    const htmlExtension = extensions.getExtension('vscode.html-language-features')
    await htmlExtension?.activate()

    const serverModule = context.asAbsolutePath(
        path.join('node_modules', 'ecmarkup-language-server', 'lib', 'server.js')
    )
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=29384'] },
        },
    }
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ language: 'ecmarkup' }, { pattern: '*.emu' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.emu'),
        },
    }
    client = new LanguageClient('ecmarkup.language.service', 'ecmarkup language service', serverOptions, clientOptions)
    client.start()

    context.subscriptions.push(commands.registerCommand('ecmarkup.restart', () => client.restart()))
}

export async function deactivate() {
    return client?.stop()
}
