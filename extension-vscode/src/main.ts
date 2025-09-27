import type { ExtensionContext } from 'vscode'
import { commands, extensions, workspace } from 'vscode'
import type { LanguageClient as WebClient, LanguageClientOptions as WebOptions } from 'vscode-languageclient/browser.js'
import type { LanguageClient as NodeClient, LanguageClientOptions as NodeOptions } from 'vscode-languageclient/node.js'
import { io } from './io/general.js'

let client: NodeClient | WebClient
export async function onActivate(
    context: ExtensionContext,
    createClient: (options: NodeOptions | WebOptions) => NodeClient | WebClient,
) {
    // See: https://github.com/microsoft/vscode/issues/160585
    const htmlExtension = extensions.getExtension('vscode.html-language-features')
    // Note: do not remove the await here.
    // we need to let the HTML extension start first, otherwise our semanticTokens will be ignored due to emit order.
    await htmlExtension?.activate()

    const clientOptions: WebOptions = {
        documentSelector: [{ language: 'ecmarkup' }, { pattern: '*.emu' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.emu'),
        },
    }
    client = createClient(clientOptions)
    client.start()

    Object.entries(io).forEach(([key, f]) => {
        context.subscriptions.push(client!.onRequest(`io/${key}`, (params) => f(...params)))
    })

    context.subscriptions.push(
        commands.registerCommand('ecmarkup.restart', async () => {
            if ('restart' in client) {
                return client.restart()
            } else {
                await client.stop()
                await client.dispose()
                client = createClient(clientOptions)
                return client.start()
            }
        }),
    )
}

export async function onDeactivate() {
    return client?.stop()
}
