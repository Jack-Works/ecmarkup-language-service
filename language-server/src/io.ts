import type { Connection } from 'vscode-languageserver'
import { timeout } from './utils/utils.js'

export interface IO {
    /**
     * @param base The current opening file.
     * @param specifier A specifier that need module resolution. e.g. `@tc39/ecma262-biblio/biblio.json`
     * @param workspace_trusted If it is allowed to evaluate any code during resolution (e.g. for Yarn PnP).
     */
    resolveJSONFile(base: string, specifier: string, workspace_trusted: boolean): Promise<unknown>
}

export function wrap_io(connection: Connection) {
    return {
        __proto__: new Proxy(
            {},
            {
                get(t, p) {
                    Object.defineProperty(t, p, {
                        configurable: true,
                        value: (...args: unknown[]) => {
                            return timeout(connection.sendRequest(`io/${String(p)}`, args))
                        },
                    })
                    // biome-ignore lint/suspicious/noExplicitAny: reflecting
                    return (t as any)[p]
                },
            },
        ),
        // biome-ignore lint/suspicious/noExplicitAny: reflecting
    } as any as IO
}
