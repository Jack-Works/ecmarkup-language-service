import type { ExtensionContext, TextDocument } from 'vscode'
import { commands, extensions, languages, workspace } from 'vscode'
import type { LanguageClient as WebClient, LanguageClientOptions as WebOptions } from 'vscode-languageclient/browser.js'
import type { LanguageClient as NodeClient, LanguageClientOptions as NodeOptions } from 'vscode-languageclient/node.js'
import { client as clientAPI } from './io/general.js'
import { createRemoteIO } from './io/server.js'

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

    // VS Code assigns a language by filename/extension, so .html spec files (used by
    // some TC39 proposals, e.g. Temporal) open as plain HTML and the language server
    // never sees them. Sniff their content instead: if an HTML document contains an
    // <emu-clause tag, switch it to the ecmarkup language so the server takes over.
    // See: https://github.com/Jack-Works/ecmarkup-language-service/issues/12
    context.subscriptions.push(workspace.onDidOpenTextDocument(detectEcmarkupInHtml))
    workspace.textDocuments.forEach(detectEcmarkupInHtml)

    Object.entries(clientAPI).forEach(([key, f]) => {
        context.subscriptions.push(client!.onRequest(`api/${key}`, (params) => f(...params)))
    })

    const server = createRemoteIO(client)

    workspace.onDidChangeConfiguration(updateConfiguration)
    updateConfiguration()
    function updateConfiguration() {
        const config = workspace.getConfiguration('ecmarkup')
        server.enableDiagnostics(config.get<boolean>('diagnostic') ?? true)
        // If detection was just turned on, pick up already-open HTML spec files.
        if (config.get<boolean>('detectInHtml') ?? true) workspace.textDocuments.forEach(detectEcmarkupInHtml)
    }

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

function detectEcmarkupInHtml(document: TextDocument) {
    if (document.languageId !== 'html') return
    if (!(workspace.getConfiguration('ecmarkup').get<boolean>('detectInHtml') ?? true)) return
    if (!document.getText().includes('<emu-clause')) return
    // The switch fires onDidOpenTextDocument again, but with languageId 'ecmarkup',
    // so the languageId guard above prevents re-entry.
    languages.setTextDocumentLanguage(document, 'ecmarkup')
}

export async function onDeactivate() {
    return client?.stop()
}
