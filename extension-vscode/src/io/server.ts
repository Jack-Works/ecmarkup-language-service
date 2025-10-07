import type { LanguageClient as WebClient,  } from 'vscode-languageclient/browser.js'
import type { LanguageClient as NodeClient,  } from 'vscode-languageclient/node.js'
import type { ServerAPI } from '../../../language-server/src/workspace/io.js'
import { timeout } from '../utils/timeout.js'

export function createRemoteIO(client: NodeClient | WebClient) {
    const server: Partial<ServerAPI> = {
    }
    Object.setPrototypeOf(
        server,
        new Proxy(
            {},
            {
                get(_target, key) {
                    Object.defineProperty(server, key, {
                        configurable: true,
                        value: (...args: unknown[]) => {
                            return timeout(client.sendRequest(`api/${String(key)}`, args))
                        },
                    })
                    // biome-ignore lint/suspicious/noExplicitAny: reflecting
                    return (server as any)[key]
                },
            },
        ),
    )
    return server as ServerAPI
}
