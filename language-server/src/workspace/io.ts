import type { BiblioEntry } from '@tc39/ecma262-biblio'
import type { Connection } from 'vscode-languageserver'
import { timeout } from '../utils/timeout.js'

export interface IO {
    /**
     * @param base Resolve the local installed @tc39/ecma262-biblio/biblio.json
     */
    resolveBiblio(base: string): Promise<{ entries: BiblioEntry[]; location?: string; source?: string } | undefined>

    warn(...message: unknown[]): Promise<void>
}

export function createRemoteIO(connection: Connection) {
    const io: Partial<IO> = {
        async warn(...message) {
            connection.console.warn(message.join(' '))
        },
    }
    Object.setPrototypeOf(
        io,
        new Proxy(
            {},
            {
                get(_target, key) {
                    Object.defineProperty(io, key, {
                        configurable: true,
                        value: (...args: unknown[]) => {
                            return timeout(connection.sendRequest(`io/${String(key)}`, args))
                        },
                    })
                    // biome-ignore lint/suspicious/noExplicitAny: reflecting
                    return (io as any)[key]
                },
            },
        ),
    )
    return io as IO
}
