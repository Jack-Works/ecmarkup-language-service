import dedent from 'dedent-js'
import { type ChildNode, type Document, type Element, type Node, parse, type TextNode } from 'parse5'
import { isCommentNode, isElementNode, isTextNode } from 'parse5/lib/tree-adapters/default.js'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Range } from 'vscode-languageserver-types'
import { lazy } from '../utils/lazy.js'
import { parseGrammarkdown } from './grammarkdown.js'
import { find_first, getAttributeValuePosition, getNodeInnerText, getRelativePositionToTagStart } from './html.js'
import type { DefinitionSymbol, NodeRelativeRange, SymbolInfo } from './symbol.js'

export class EcmarkupDocument {
    public readonly html: Document
    constructor(public readonly text: TextDocument) {
        this.html = parse(text.getText(), { sourceCodeLocationInfo: true })
    }

    @lazy accessor grammars: readonly SymbolInfo[] = lazy.of(() => {
        const result: SymbolInfo[] = []
        const source = this.text.getText()
        function visit(node: ChildNode) {
            if (isTextNode(node)) result.push(...parseTextNode(node, source))
            else if (isCommentNode(node)) return
            else if (node.tagName === 'emu-grammar') {
                const isDefinition = !!node.attrs.some((attr) => attr.value === 'definition')
                result.push(...parseGrammarkdown(node, isDefinition, source))
            } else if (node.tagName === 'emu-prodref') {
                const name = node.attrs.find((attr) => attr.name === 'name')?.value
                const position =
                    (getAttributeValuePosition(source, node, 'name') ?? 0) - (node.sourceCodeLocation?.startOffset ?? 0)
                if (name && position) {
                    result.push({
                        type: 'reference',
                        node,
                        name,
                        range: {
                            position,
                            length: name.length,
                        },
                    })
                }
            } else if ('childNodes' in node && node.tagName !== 'script' && node.tagName !== 'style') {
                node.childNodes.forEach(visit)
            }
        }
        this.html.childNodes.forEach(visit)
        return result
    })

    @lazy accessor localDefinedGrammars: readonly DefinitionSymbol[] = lazy.of(() =>
        this.grammars.filter((grammar): grammar is DefinitionSymbol => grammar.type === 'define'),
    )

    getRelativeRange(node: ChildNode, range: NodeRelativeRange) {
        const tagStart = node.sourceCodeLocation!.startOffset
        return Range.create(
            this.text.positionAt(tagStart + range.position),
            this.text.positionAt(tagStart + range.position + range.length),
        )
    }

    getRelativeRangeToInnerText(node: ChildNode, position: number, length: number) {
        let tagStart = node.sourceCodeLocation!.startOffset
        if (isElementNode(node)) {
            tagStart = node.sourceCodeLocation!.startTag.endOffset
        }
        return Range.create(
            this.text.positionAt(tagStart + position),
            this.text.positionAt(tagStart + position + length),
        )
    }

    getAbstractOperationHeader(offset: number) {
        return getAbstractOperationHeader(this.findElementAt(offset))
    }

    @lazy accessor localDefinedAbstractOperations: readonly DefinitionSymbol[] = lazy.of(() => {
        const result: DefinitionSymbol[] = []
        const source = this.text.getText()
        function visit(node: Element) {
            if (node.tagName === 'emu-clause' && node.attrs.some((attr) => attr.name === 'type')) {
                const header = getAbstractOperationHeader(node)
                const headerInnerText = getNodeInnerText(source, header)
                if (header && headerInnerText) {
                    const regex = /(\w+) \(/
                    const nameLike = regex.exec(headerInnerText)

                    const firstNonEmpty = /\S/.exec(headerInnerText) || { index: 0 }
                    const lastNonEmpty = /\S\s*$/.exec(headerInnerText) || { index: 0 }
                    if (nameLike) {
                        result.push({
                            type: 'define',
                            node: header,
                            name: nameLike[1]!,
                            summary: dedent(headerInnerText),
                            range: {
                                position: getRelativePositionToTagStart(header, nameLike.index),
                                length: nameLike[1]!.length,
                            },
                            fullDefinitionRange: {
                                position: getRelativePositionToTagStart(header, firstNonEmpty.index),
                                length: lastNonEmpty.index - firstNonEmpty.index + 1,
                            },
                        })
                        // AO defines should not nest with each other
                        return
                    }
                }
            }
            if (node.tagName !== 'script' && node.tagName !== 'style') {
                node.childNodes.filter(isElementNode).forEach(visit)
            }
        }
        this.html.childNodes.filter(isElementNode).forEach(visit)
        return result
    })

    findReferencesOfLocalAbstractOperation(word: string) {
        const operation = this.localDefinedAbstractOperations.find((operation) => operation.name === word)
        if (!operation) return undefined
        const source = this.text.getText()
        const location: Range[] = []
        const re =
            'escape' in RegExp
                ? new RegExp(
                      `\\b${
                          // biome-ignore lint/suspicious/noExplicitAny: remove after Node 24
                          (RegExp.escape as any)(word)
                      }\\b`,
                      'gu',
                  )
                : // bless us
                  new RegExp(`\\b${word}\\b`, 'g')
        for (const match of source.matchAll(re)) {
            location.push(
                Range.create(this.text.positionAt(match.index), this.text.positionAt(match.index + word.length)),
            )
        }
        return location
    }

    findElementAt(offset: number) {
        function visitor(node: Node): Element | undefined {
            if (isElementNode(node)) {
                const start = node.sourceCodeLocation?.startOffset
                const end = node.sourceCodeLocation?.endOffset
                if (start && end) {
                    if (start <= offset && offset <= end) {
                        if (isElementNode(node)) return find_first(node.childNodes, visitor) || node
                        return node
                    } else return undefined
                }
            }
            if ('childNodes' in node) return find_first(node.childNodes, visitor)
            return undefined
        }
        const result = find_first(this.html.childNodes, visitor)
        const tag = result?.nodeName
        if (tag === 'ins' || tag === 'del') return result?.parentNode || result
        return result
    }

    getNodeInnerText(node: Node | undefined): string | undefined {
        if (!node) return undefined
        return getNodeInnerText(this.text.getText(), node)
    }
}

function parseTextNode(node: TextNode, fullText: string): SymbolInfo[] {
    const info: SymbolInfo[] = []
    const innerText = getNodeInnerText(fullText, node)
    if (!innerText) return info
    for (const match of innerText.matchAll(/\|(?<productionName>\w+)\|/g)) {
        const name = match.groups!['productionName']!
        info.push({
            type: 'reference',
            node,
            name,
            range: {
                position: match.index! + 1,
                length: name.length,
            },
        })
    }
    return info
}

export function getAbstractOperationHeader(node: Node | undefined): Element | undefined {
    if (!node) return
    if ('childNodes' in node) {
        const elements = node.childNodes.filter(isElementNode)
        const index = elements.findIndex((node) => node.nodeName === 'h1')
        const next = elements[index + 1]
        if (next?.nodeName === 'dl' || next?.nodeName === 'p') return elements[index]
    }
    if ('parentNode' in node) {
        const elements = node.parentNode.childNodes.filter(isElementNode)
        const index = elements.findIndex((node) => node.nodeName === 'h1')
        const next = elements[index + 1]
        if (next?.nodeName === 'dl' || next?.nodeName === 'p') return elements[index]
        return undefined
    }
    return undefined
}
