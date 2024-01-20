const w = /[a-zA-Z0-9\-]/
export function expandWord(text: string, offset: number, extraCharSet?: RegExp) {
    let leftBoundary = offset
    let rightBoundary = offset
    while (
        leftBoundary > 0 &&
        (w.test(text[leftBoundary - 1]!) || (extraCharSet ? extraCharSet.test(text[leftBoundary - 1]!) : false))
    )
        leftBoundary--
    while (
        rightBoundary < text.length &&
        (w.test(text[rightBoundary]!) || (extraCharSet ? extraCharSet.test(text[rightBoundary]!) : false))
    )
        rightBoundary++

    let isGrammar = false
    let isGrammarLeading = false
    let isIntrinsic = false
    let isIntrinsicLeading = false
    let isHash = false
    let isWellKnownSymbol = false
    let isVariable = false
    let isVariableLeading = false

    const left = text[leftBoundary - 1]
    const right = text[rightBoundary]
    if (left === '|') {
        isGrammarLeading = true
        isGrammar = right === '|'
    }
    if (left === '%') {
        isIntrinsicLeading = true
        isIntrinsic = right === '%'
    }
    if (left === '_') {
        isVariableLeading = true
        isVariable = right === '_'
    }
    if (left === '#') isHash = true
    if (left === '@' && text[leftBoundary - 2] === '@') isWellKnownSymbol = true

    return {
        before: text.slice(leftBoundary, offset),
        after: text.slice(offset, rightBoundary),
        word: text.slice(leftBoundary, rightBoundary),
        isGrammar,
        isGrammarLeading,
        isIntrinsic,
        isIntrinsicLeading,
        isVariable,
        isVariableLeading,
        isHash,
        isWellKnownSymbol,
    }
}
