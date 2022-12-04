import { Uri, type ExtensionContext } from 'vscode'
import { LanguageClient, type LanguageClientOptions } from 'vscode-languageclient/browser.js'
import { onActivate } from './main'

export async function activate(context: ExtensionContext) {
    onActivate(context, createWorkerLanguageClient)

    function createWorkerLanguageClient(clientOptions: LanguageClientOptions) {
        const serverMain = Uri.joinPath(context.extensionUri, 'lib/language-server-web.js')
        const worker = new Worker(serverMain.toString(true))

        return new LanguageClient('ecmarkup.language.service', 'ecmarkup language service', clientOptions, worker)
    }
}

export { onDeactivate as deactivate } from './main'
