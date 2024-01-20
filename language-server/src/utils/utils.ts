import type { Position, Range } from 'vscode-languageserver-types'

export function createPosition(line: number, character: number): Position {
    return { line, character }
}
createPosition.zero = createPosition(0, 0)
export function createRange(start: Position, end: Position): Range {
    return { start, end }
}
