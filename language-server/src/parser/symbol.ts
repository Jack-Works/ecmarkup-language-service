import type { ChildNode } from 'parse5'

export type SymbolInfo = DefinitionSymbol | ReferenceSymbol
interface Symbol {
    name: string
    range: NodeRelativeRange
    /** Containing HTML Node */
    node: ChildNode
}
export interface DefinitionSymbol extends Symbol {
    type: 'define'
    /** Hover text of the symbol */
    summary: string
    /** Used to compute `targetRange` in LSP, relative to the start of the HTML tag */
    fullDefinitionRange: NodeRelativeRange
}

export interface ReferenceSymbol extends Symbol {
    type: 'reference'
}

export interface NodeRelativeRange {
    /** the position is relative to the start of the tag */
    position: number
    length: number
}
