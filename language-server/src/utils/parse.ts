import type { Nonterminal, Production, SourceFile } from 'grammarkdown'
import { type LanguageService, type Node, getLanguageService } from 'vscode-html-languageservice'
import type { Range } from 'vscode-languageserver-textdocument'
import { NodeVisitor, Parser, type TextDocument } from '../lib.js'
import { getLanguageModelCache } from './parseCache.js'
import { createRange } from './utils.js'

let ls: LanguageService
let parser: Parser
export const getSourceFile = getLanguageModelCache(10, 60, (doc) => new EcmarkupDocument(doc))

export class EcmarkupDocument {
    constructor(public readonly text: TextDocument) {
        ls ??= getLanguageService()
        this.html = ls.parseHTMLDocument(text)
    }
    private html
    private parseGrammar() {
        const result: GrammarkdownInfo[] = []
        const fullText = this.text.getText()
        function visit(node: Node) {
            if (node.tag === 'emu-grammar') {
                result.push(...parseGrammarkdown(node, !!node.attributes?.['type']?.includes('definition'), fullText))
            } else if (node.tag !== 'script' && node.tag !== 'style') {
                result.push(...parseNormalText(node, fullText))
                node.children.forEach(visit)
            }
        }
        this.html.roots.forEach(visit)
        return result
    }
    private info: GrammarkdownInfo[] | undefined
    getGrammarDefinition(name: string) {
        this.info ??= this.parseGrammar()
        const { info } = this
        const result: [GrammarkdownDefine, Range][] = []
        for (const def of info) {
            if (def.type !== 'define' || def.name !== name) continue
            result.push([
                def,
                createRange(
                    this.text.positionAt(def.node.startTagEnd! + def.pos),
                    this.text.positionAt(def.node.startTagEnd! + def.pos + def.name.length),
                ),
            ])
        }
        return result
    }
    getLocalDefinedGrammars() {
        this.info ??= this.parseGrammar()
        return this.info.filter((x) => x.type === 'define').map((x) => x.name)
    }
    getAlgHeader(offset: number) {
        const node = this.findNodeAt(offset)
        if (!node.parent) return undefined
        const index = node.parent.children.findIndex((x) => x.tag === 'h1')
        const next = node.parent.children[index + 1]
        if (next?.tag === 'dl' || next?.tag === 'p') return node.parent.children[index]
        return undefined
    }
    findNodeAt(offset: number) {
        const node = this.html.findNodeAt(offset)
        if (node.tag === 'ins' || node.tag === 'del') return node.parent || node
        return node
    }
    getNodeText(node: Node): string
    getNodeText(node: Node | undefined): string | undefined
    getNodeText(node: Node | undefined): string | undefined {
        if (!node) return undefined
        return this.text.getText().slice(node.startTagEnd || node.start, node.endTagStart || node.end)
    }
}

function parseNormalText(node: Node, fullText: string): GrammarkdownInfo[] {
    const info: GrammarkdownInfo[] = []
    if (!node.startTagEnd) return info
    const textContent = fullText.slice(node.startTagEnd, node.endTagStart)
    for (const match of textContent.matchAll(/\|\w+\|/g)) {
        info.push({
            name: match[0].slice(1, -1),
            node,
            pos: match.index!,
            type: 'reference',
        })
    }
    return info
}
function parseGrammarkdown(node: Node, isDefinition: boolean, fullText: string): GrammarkdownInfo[] {
    if (!node.startTagEnd) return []
    parser ??= new Parser()

    const info: GrammarkdownInfo[] = []

    const textContent = fullText.slice(node.startTagEnd, node.endTagStart)

    const doc = parser.parseSourceFile('test.grammarkdown', textContent)
    const visitor = new Visitor(info, isDefinition, node, doc)
    visitor.visitSourceFile(doc)

    return info
}

export type GrammarkdownInfo = GrammarkdownDefine | GrammarkdownReference
export interface GrammarkdownInfoBase {
    name: string
    pos: number
    node: Node
}
export interface GrammarkdownDefine extends GrammarkdownInfoBase {
    type: 'define'
    summary: string
}
export interface GrammarkdownReference extends GrammarkdownInfoBase {
    type: 'reference'
}

class Visitor extends NodeVisitor {
    constructor(
        private info: GrammarkdownInfo[],
        private isDefinitionSite: boolean,
        private node: Node,
        private sourceFile: SourceFile,
    ) {
        super()
    }
    override visitNonterminal(node: Nonterminal): Nonterminal {
        if (node.name.text) {
            this.info.push({
                name: node.name.text,
                node: this.node,
                pos: node.getStart(this.sourceFile),
                type: 'reference',
            })
        }
        return super.visitNonterminal(node)
    }

    override visitProduction(node: Production): Production {
        if (node.name.text) {
            if (this.isDefinitionSite) {
                this.info.push({
                    name: node.name.text,
                    node: this.node,
                    pos: node.getStart(this.sourceFile),
                    type: 'define',
                    summary: node.getText(this.sourceFile),
                })
            } else {
                this.info.push({
                    name: node.name.text,
                    node: this.node,
                    pos: node.getStart(this.sourceFile),
                    type: 'reference',
                })
            }
        }
        return super.visitProduction(node)
    }
}
