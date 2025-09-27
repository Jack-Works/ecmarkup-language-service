import type { Nonterminal, Production, SourceFile } from 'grammarkdown'
import { getLanguageService, type HTMLDocument, type LanguageService, type Node } from 'vscode-html-languageservice'
import { Range } from 'vscode-languageserver-types'
import { NodeVisitor, Parser, type TextDocument } from '../lib.js'
import { lazy } from './lazy.js'

let ls: LanguageService
let parser: Parser

export class EcmarkupDocument {
    constructor(public readonly text: TextDocument) {
        ls ??= getLanguageService()
        this.html = ls.parseHTMLDocument(text)
    }
    public html: HTMLDocument
    @lazy accessor grammars: readonly EntryInfo[] = lazy.of(() => {
        const result: EntryInfo[] = []
        const fullText = this.text.getText()
        function visit(node: Node) {
            if (node.tag === 'emu-grammar') {
                const isDefinition = !!node.attributes?.['type']?.includes('definition')
                result.push(...parseGrammarkdown(node, isDefinition, fullText))
            } else if (node.tag !== 'script' && node.tag !== 'style') {
                result.push(...parseNormalText(node, fullText))
                node.children.forEach(visit)
            }
        }
        this.html.roots.forEach(visit)
        return result
    })
    @lazy accessor localDefinedGrammars: readonly EntryDefinition[] = lazy.of(() =>
        this.grammars.filter((x): x is EntryDefinition => x.type === 'define'),
    )
    getEntryRange(entry: EntryInfo) {
        const realPos = entry.node.startTagEnd! + entry.pos
        const offset = this.text.getText()[realPos] === '|' ? 1 : 0
        const start = this.text.positionAt(realPos + offset)
        return Range.create(
            start,
            this.text.positionAt(entry.node.startTagEnd! + entry.pos + entry.name.length + offset),
        )
    }

    getAlgHeader(offset: number) {
        const node = this.findNodeAt(offset)
        if (!node.parent) return undefined
        const index = node.parent.children.findIndex((x) => x.tag === 'h1')
        const next = node.parent.children[index + 1]
        if (next?.tag === 'dl' || next?.tag === 'p') return node.parent.children[index]
        return undefined
    }

    @lazy accessor localDefinedAbstractOperations: readonly EntryDefinition[] = lazy.of(() => {
        const result: EntryDefinition[] = []
        const fullText = this.text.getText()
        function visit(node: Node) {
            if (node.tag === 'emu-clause' && node.attributes?.['type']) {
                const h1 = node.children.findIndex((x) => x.tag === 'h1')
                const next = node.children[h1 + 1]
                if (h1 !== -1 && (next?.tag === 'dl' || next?.tag === 'p')) {
                    const header = node.children[h1]!
                    const text = fullText.slice(header.startTagEnd, header.endTagStart)
                    const regex = /(\w+) \(/
                    const nameLike = regex.exec(text)
                    if (nameLike) {
                        result.push({
                            type: 'define',
                            name: nameLike[1]!,
                            node: header,
                            pos: nameLike.index,
                            summary: dedent(text),
                        })
                        // AO defines should not nest with each other
                        return
                    }
                }
            }
            if (node.tag !== 'script' && node.tag !== 'style') {
                node.children.forEach(visit)
            }
        }
        this.html.roots.forEach(visit)
        return result
    })

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

function parseNormalText(node: Node, fullText: string): EntryInfo[] {
    const info: EntryInfo[] = []
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
function parseGrammarkdown(node: Node, isDefinition: boolean, fullText: string): EntryInfo[] {
    if (!node.startTagEnd) return []
    parser ??= new Parser()

    const info: EntryInfo[] = []

    const textContent = fullText.slice(node.startTagEnd, node.endTagStart)

    const doc = parser.parseSourceFile('test.grammarkdown', textContent)
    const visitor = new Visitor(info, isDefinition, node, doc)
    visitor.visitSourceFile(doc)

    return info
}

export type EntryInfo = EntryDefinition | EntryReference
export interface EntryInfoBase {
    name: string
    pos: number
    node: Node
}
export interface EntryDefinition extends EntryInfoBase {
    type: 'define'
    summary: string
}
export interface EntryReference extends EntryInfoBase {
    type: 'reference'
}

class Visitor extends NodeVisitor {
    constructor(
        private info: EntryInfo[],
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
                    summary: dedent(node.getText(this.sourceFile)),
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

export function dedent(text: string) {
    const minIndent = text.split('\n').reduce((min, line) => {
        if (line.trim() === '') return min
        const match = line.match(/^(\s+)/)
        if (match) {
            return Math.min(min, match[0].length)
        }
        return min
    }, Infinity)
    if (minIndent === Infinity || minIndent === 0) return text.trim()
    return text
        .split('\n')
        .map((line) => line.slice(minIndent))
        .join('\n')
        .trim()
}
