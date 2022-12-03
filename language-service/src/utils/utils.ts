import type { Position, Range } from 'vscode-languageserver-types'

export function unreachable(_: never) {
    throw new TypeError('Unreachable')
}

export function createPosition(line: number, character: number): Position {
    return { line, character }
}
createPosition.zero = createPosition(0, 0)
export function createRange(start: Position, end: Position): Range {
    return { start, end }
}
export function createRangeZeroLength(position: Position): Range {
    return { start: position, end: position }
}
