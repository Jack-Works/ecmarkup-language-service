const IsText = /[\w%@|#\-_\.]/
export function findWholeWord(fullText: string, offset: number): [string, string, string] {
    let from = offset
    let to = offset
    while (from > 0 && IsText.test(fullText[from - 1]!)) from--
    while (to < fullText.length && IsText.test(fullText[to]!)) to++
    return [fullText.slice(from, offset), fullText.slice(offset, to), fullText.slice(from, to)]
}
