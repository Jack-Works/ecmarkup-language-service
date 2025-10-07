import type { BiblioEntry } from '@tc39/ecma262-biblio'
import type { Connection } from 'vscode-languageserver'
import { timeout } from '../utils/timeout.js'

export interface ClientAPI {
    /**
     * @param base Resolve the local installed @tc39/ecma262-biblio/biblio.json
     */
    resolveBiblio(base: string): Promise<{ entries: BiblioEntry[]; location?: string; source?: string } | undefined>

    getEditorCursorCount(): Promise<number>

    warn(...message: unknown[]): Promise<void>
}

export interface ServerAPI {
    enableDiagnostics(boolean: boolean): void
}

export function createRemoteIO(connection: Connection) {
    const client: Partial<ClientAPI> = {
        async warn(...message) {
            connection.console.warn(message.join(' '))
        },
    }
    Object.setPrototypeOf(
        client,
        new Proxy(
            {},
            {
                get(_target, key) {
                    Object.defineProperty(client, key, {
                        configurable: true,
                        value: (...args: unknown[]) => {
                            return timeout(connection.sendRequest(`api/${String(key)}`, args))
                        },
                    })
                    // biome-ignore lint/suspicious/noExplicitAny: reflecting
                    return (client as any)[key]
                },
            },
        ),
    )
    return client as ClientAPI
}
