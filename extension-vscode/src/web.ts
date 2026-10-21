import { type ExtensionContext, Uri } from 'vscode'
import { LanguageClient, type LanguageClientOptions } from 'vscode-languageclient/browser'
import { onActivate } from './main.js'

export async function activate(context: ExtensionContext) {
    return onActivate(context, createWorkerLanguageClient)

    function createWorkerLanguageClient(clientOptions: LanguageClientOptions) {
        const serverMain = Uri.joinPath(context.extensionUri, 'lib/language-server-web.js')
        const worker = new Worker(serverMain.toString(true))

        return new LanguageClient('ecmarkup.language.service', 'ecmarkup language service', worker, clientOptions)
    }
}

export { onDeactivate as deactivate } from './main.js'
