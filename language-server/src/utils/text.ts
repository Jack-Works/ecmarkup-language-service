const matcher =
    /(?<wellKnownSymbol>@@[\w_.]*)|(?<hash>#[\w\-_.]*)|(?<intrinsics>%[\w.]*%?)|(?<grammar>\|[\w.]*\|?)|(?<variable>_[\w.]*_?)|(?<call>[?!]\w*)|(?<plain>[\w.-]*)/dgu
export function word_at_cursor(text: string, offset: number) {
    const lastSpace = text.lastIndexOf(' ', offset - 1)
    const lastNewLine = text.lastIndexOf('\n', offset - 1)
    const lastBoundary = Math.max(lastSpace, lastNewLine)

    const lastLastSpace = text.lastIndexOf(' ', lastBoundary - 1)
    const lastLastNewLine = text.lastIndexOf('\n', lastBoundary - 1)
    const lastLastBoundary = Math.max(lastLastSpace, lastLastNewLine)

    const nextNewSpace = text.indexOf(' ', offset)
    const nextNewLine = text.indexOf('\n', offset)
    let nextBoundary = Math.max(nextNewSpace, nextNewLine)
    if (nextBoundary === -1) nextBoundary = text.length

    matcher.lastIndex = lastBoundary

    let word = ''
    let word_start = lastBoundary
    let word_end = nextBoundary
    for (const match of text.matchAll(matcher)) {
        if (match.index < lastBoundary) continue
        if (match.index > nextBoundary) break
        const indice = match.indices![0]!
        if (indice[0] <= offset && indice[1] >= offset) {
            word = match[0]
            word_start = indice[0]
            word_end = indice[1]
            break
        }
    }

    const leadingContextWord =
        lastLastBoundary === lastBoundary
            ? ''
            : text
                  .slice(lastLastBoundary + 1, lastBoundary)
                  .trimEnd()
                  .toLowerCase()

    let isGrammar = false
    let isGrammarLeading = false
    let isIntrinsic = false
    let isIntrinsicLeading = false
    let isHash = false
    let isWellKnownSymbol = false
    let isVariable = false
    let isVariableLeading = false
    let isCall = false
    switch (word[0]) {
        case '|':
            isGrammarLeading = true
            word_start++
            break
        case '%':
            isIntrinsicLeading = true
            word_start++
            break
        case '_':
            isVariableLeading = true
            word_start++
            break
        case '#':
            isHash = true
            word_start++
            break
        case '@':
            isWellKnownSymbol = word[1] === '@'
            word_start += 2
            break
        case '?':
        case '!':
            isCall = true
            word_start++
            break
    }
    switch (word[word.length - 1]) {
        case '|':
            isGrammar = isGrammarLeading
            word_end--
            break
        case '%':
            isIntrinsic = isIntrinsicLeading
            word_end--
            break
        case '_':
            isVariable = isVariableLeading
            word_end--
            break
    }

    return {
        leadingContextWord,
        leftBoundary: word_start,
        rightBoundary: word_end,
        word: text.slice(word_start, word_end),
        full_word: word,
        isGrammar,
        isGrammarLeading,
        isIntrinsic,
        isIntrinsicLeading,
        isVariable,
        isVariableLeading,
        isHash,
        isWellKnownSymbol,
        isCall,
    }
}
