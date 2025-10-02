import dedent from 'dedent-js'
import { NodeVisitor, type Nonterminal, Parser, type Production, type SourceFile } from 'grammarkdown'
import type { ChildNode, Element } from 'parse5'
import { getNodeInnerText } from './html.js'
import type { SymbolInfo } from './symbol.js'

let parser: Parser

export function parseGrammarkdown(node: Element, isDefinition: boolean, source: string): SymbolInfo[] {
    const info: SymbolInfo[] = []
    const innerText = getNodeInnerText(source, node)
    if (!innerText) return info

    parser ??= new Parser()
    const tag_start =
        (node.sourceCodeLocation?.startTag.endOffset ?? 0) - (node.sourceCodeLocation?.startTag.startOffset ?? 0)
    const doc = parser.parseSourceFile('test.grammarkdown', innerText)
    const visitor = new Visitor(info, isDefinition, node, doc, tag_start)
    visitor.visitSourceFile(doc)

    return info
}

class Visitor extends NodeVisitor {
    constructor(
        private info: SymbolInfo[],
        private isDefinition: boolean,
        private node: ChildNode,
        private sourceFile: SourceFile,
        private tagStartLength: number,
    ) {
        super()
    }

    override visitNonterminal(node: Nonterminal): Nonterminal {
        if (node.name.text) {
            const position = this.tagStartLength + node.getStart(this.sourceFile)
            this.info.push({
                type: 'reference',
                node: this.node,
                name: node.name.text,
                range: {
                    position,
                    length: node.name.text.length,
                },
            })
        }
        return super.visitNonterminal(node)
    }

    override visitProduction(node: Production): Production {
        if (node.name.text) {
            const start = this.tagStartLength + node.getStart(this.sourceFile)
            if (this.isDefinition) {
                this.info.push({
                    type: 'define',
                    node: this.node,
                    name: node.name.text,
                    summary: dedent(node.getText(this.sourceFile)),
                    range: {
                        position: start,
                        length: node.name.text.length,
                    },
                    fullDefinitionRange: {
                        position: start,
                        length: node.getWidth(this.sourceFile),
                    },
                })
            } else {
                this.info.push({
                    type: 'reference',
                    node: this.node,
                    name: node.name.text,
                    range: {
                        position: start,
                        length: node.name.text.length,
                    },
                })
            }
        }
        return super.visitProduction(node)
    }
}
