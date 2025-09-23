import type { Position, Range } from 'vscode-languageserver-types'

export function createPosition(line: number, character: number): Position {
    return { line, character }
}
createPosition.zero = createPosition(0, 0)
export function createRange(start: Position, end: Position): Range {
    return { start, end }
}

export function timeout<T>(promise: Promise<T>, timeout = 1000): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            reject(new Error('Operation timed out'))
        }, timeout)
        promise
            .then((res) => {
                clearTimeout(id)
                resolve(res)
            })
            .catch((err) => {
                clearTimeout(id)
                reject(err)
            })
    })
}
