import type { ChildNode, Element, Node } from 'parse5'
import { isElementNode, isTextNode } from 'parse5/lib/tree-adapters/default.js'

export function getFirstElementChild(node: Node | undefined): Element | undefined {
    if (!node) return undefined
    if (isElementNode(node)) return node
    if ('childNodes' in node) return node.childNodes.find(isElementNode)
    return undefined
}

export function find_first<T, Q>(array: T[], mapper: (value: T) => Q | undefined) {
    for (const element of array) {
        const value = mapper(element)
        if (value) return value
    }
    return undefined
}

/**
 * @param node Node the position relative to
 * @param position Position relative to the end of the start tag
 * @returns Position relative to the start of the start tag
 */
export function getRelativePositionToTagStart(node: ChildNode, position: number) {
    if (!isElementNode(node)) return position
    return position + (node.sourceCodeLocation!.startTag.endOffset - node.sourceCodeLocation!.startOffset)
}

/**
 * @param source Full source file
 * @param node Node to get innerText
 */
export function getNodeInnerText(source: string, node: Node | undefined) {
    if (!node) return
    if (isTextNode(node)) {
        return node.value
    } else if (isElementNode(node)) {
        const from = node.sourceCodeLocation?.startTag.endOffset
        const to = node.sourceCodeLocation?.endTag?.startOffset
        if (from !== undefined && to !== undefined) return source.slice(from, to)
    }
    return undefined
}

export function getAttributeValuePosition(source: string, node: Element, attribute: string) {
    const attribute_start = node.sourceCodeLocation?.attrs?.[attribute]?.startOffset
    const attribute_end = node.sourceCodeLocation?.attrs?.[attribute]?.endOffset
    if (!attribute_start || !attribute_end) return
    const attr = source.slice(attribute_start, attribute_end)
    const value_start = attr.match(/=\s*['"](?<anything>.)/d)
    if (value_start) {
        return attribute_start + value_start.indices![1]![0]
    }
    return undefined
}

export function withinAttributeValue(source: string, node: Element, attribute: string, offset: number) {
    const value_start = getAttributeValuePosition(source, node, attribute)
    const value_end = node.sourceCodeLocation!.attrs![attribute]!.endOffset - 1
    if (!value_start || !value_end) return false
    return value_start <= offset && offset <= value_end
}
