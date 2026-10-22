import type { BiblioClause, BiblioEntry, BiblioOp, SpecOperations } from '@tc39/ecma262-biblio'
import type { DefaultTreeAdapterTypes } from 'parse5'
import { type Connection, TextEdit } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { EcmarkupDocument } from '../parser/ecmarkup.js'
import { type InsertClauseParams, type InsertClauseResult, insertClauseRequest } from '../protocol.js'
import { documents } from '../server-shared.js'
import { formatSpecValueForHeader } from '../utils/format.js'
import type { Program } from '../workspace/program.js'

type Element = DefaultTreeAdapterTypes.Element
type Node = DefaultTreeAdapterTypes.Node

const clauseNumber = /^\d+(?:\.\d+)*$/u

export class InsertClause {
    constructor(private readonly program: Program) {}

    async insert(document: TextDocument, params: InsertClauseParams): Promise<InsertClauseResult> {
        const requestedNumber = params.clauseNumber.trim()
        if (!clauseNumber.test(requestedNumber)) return null

        const sourceFile = this.program.getSourceFile(document)
        const biblio = await this.program.resolveBiblio(document.uri)
        const clauses = biblio.filter(isBiblioClause)
        const operations = biblio.filter(isBiblioOp)
        const target = clauses.find((entry) => entry.number === requestedNumber)
        if (!target) return null

        const path = getClausePath(target, clauses)
        const currentClause = findEnclosingClause(sourceFile, document.offsetAt(params.position))
        const currentBiblioClause = currentClause && findBiblioClause(sourceFile, currentClause, clauses)
        const clausesToInsert = currentBiblioClause
            ? isPrefix(currentBiblioClause.number, target.number)
                ? path.slice(currentBiblioClause.number.split('.').length)
                : [target]
            : path

        if (clausesToInsert.length === 0) return null

        const offset = document.offsetAt(params.position)
        const lineStart = document.getText().lastIndexOf('\n', offset - 1) + 1
        const beforeCursor = document.getText().slice(lineStart, offset)
        const baseIndent = beforeCursor.match(/^\s*/u)?.[0] ?? ''
        const prefix = beforeCursor.trim() ? `\n${baseIndent}` : ''
        const indentSize = normalizeIndentSize(params.indentSize)
        const block = renderClauses(clausesToInsert, operations, baseIndent, indentSize)
        const text = `${prefix}${beforeCursor.trim() ? block : block.slice(baseIndent.length)}\n`

        return [TextEdit.insert(params.position, text)]
    }

    static enable(connection: Connection, program: Program) {
        const provider = new InsertClause(program)
        connection.onRequest(insertClauseRequest, async (params: InsertClauseParams) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return provider.insert(document, params)
        })
    }
}

function isBiblioClause(entry: BiblioEntry): entry is BiblioClause {
    return entry.type === 'clause' && entry.number.length > 0
}

function isBiblioOp(entry: BiblioEntry): entry is BiblioOp {
    return entry.type === 'op'
}

function getClausePath(target: BiblioClause, clauses: readonly BiblioClause[]): BiblioClause[] {
    const parts = target.number.split('.')
    const path: BiblioClause[] = []
    for (let index = 1; index <= parts.length; index++) {
        const number = parts.slice(0, index).join('.')
        const clause = clauses.find((entry) => entry.number === number)
        if (clause) path.push(clause)
    }
    return path.length > 0 ? path : [target]
}

function findEnclosingClause(sourceFile: EcmarkupDocument, offset: number): Element | undefined {
    for (let node = sourceFile.findElementAt(offset); node; node = parentElement(node)) {
        if (node.tagName === 'emu-clause') return node
    }
    return undefined
}

function parentElement(node: Element): Element | undefined {
    const parent = node.parentNode
    return parent && isElement(parent) ? parent : undefined
}

function isElement(node: Node): node is Element {
    return 'tagName' in node
}

function findBiblioClause(
    sourceFile: EcmarkupDocument,
    node: Element,
    clauses: readonly BiblioClause[],
): BiblioClause | undefined {
    const number = getFullClauseNumber(node)
    if (number) {
        const byNumber = clauses.find((entry) => entry.number === number)
        if (byNumber) return byNumber
    }

    const heading = node.childNodes.find((child) => isElement(child) && child.tagName === 'h1')
    const title = normalizeTitle(sourceFile.getNodeInnerText(heading))
    if (!title) return undefined
    return clauses.find((entry) => normalizeTitle(entry.title) === title || normalizeTitle(entry.titleHTML) === title)
}

function getFullClauseNumber(node: Element) {
    const numbers: string[] = []
    for (let current: Element | undefined = node; current; current = parentClause(current)) {
        const number = getAttribute(current, 'number')?.trim()
        if (!number) return undefined
        numbers.unshift(number)
    }
    return numbers.join('.')
}

function parentClause(node: Element): Element | undefined {
    for (let parent = parentElement(node); parent; parent = parentElement(parent)) {
        if (parent.tagName === 'emu-clause') return parent
    }
    return undefined
}

function getAttribute(node: Element, name: string) {
    return node.attrs.find((attribute) => attribute.name === name)?.value
}

function normalizeTitle(title: string | undefined) {
    return title
        ?.replace(/<[^>]*>/gu, '')
        .replace(/\s+/gu, ' ')
        .trim()
}

function isPrefix(parent: string, child: string) {
    return child === parent || child.startsWith(`${parent}.`)
}

function renderClauses(
    clauses: readonly BiblioClause[],
    operations: readonly BiblioOp[],
    baseIndent: string,
    indentSize: number,
) {
    const indentUnit = ' '.repeat(indentSize)

    function render(index: number, indent: string): string {
        const clause = clauses[index]
        if (!clause) return ''
        const operation = clause.aoid ? operations.find((entry) => entry.aoid === clause.aoid) : undefined
        const hasOperationHeader = !!operation?.signature
        const operationType = getOperationType(operation)
        const heading = hasOperationHeader
            ? renderAbstractOperationHeading(clause, operation, indent, indentUnit)
            : [`${indent}${indentUnit}<h1>${formatClauseTitle(clause.titleHTML)}</h1>`]
        const header = hasOperationHeader
            ? [`${indent}${indentUnit}<dl class="header">`, `${indent}${indentUnit}</dl>`]
            : []
        const body = index + 1 < clauses.length ? render(index + 1, `${indent}${indentUnit}`) : `${indent}${indentUnit}`
        return [
            `${indent}<emu-clause id="${escapeAttribute(clause.id)}" number="${escapeAttribute(getLocalClauseNumber(clause))}"${
                operationType ? ` type="${escapeAttribute(operationType)}"` : ''
            }>`,
            ...heading,
            ...header,
            body,
            `${indent}</emu-clause>`,
        ].join('\n')
    }

    return render(0, baseIndent)
}

function renderAbstractOperationHeading(
    clause: BiblioClause,
    operation: BiblioOp | undefined,
    indent: string,
    indentUnit: string,
) {
    const signature = operation?.signature
    if (!operation || !signature) return [`${indent}${indentUnit}<h1>${formatClauseTitle(clause.titleHTML)}</h1>`]

    const parameters = [...signature.parameters, ...signature.optionalParameters]
    const headingIndent = `${indent}${indentUnit}`
    const contentIndent = `${headingIndent}${indentUnit}`
    const parameterIndent = `${contentIndent}${indentUnit}`
    return [
        `${headingIndent}<h1>`,
        `${contentIndent}${operation.aoid} (`,
        ...parameters.map(
            (parameter) =>
                `${parameterIndent}${formatParameter(parameter, signature.optionalParameters.includes(parameter))},`,
        ),
        `${contentIndent}): ${formatSpecValueForHeader(signature.return, operation.aoid)}`,
        `${headingIndent}</h1>`,
    ]
}

function normalizeIndentSize(indentSize: number | undefined) {
    if (typeof indentSize !== 'number' || !Number.isInteger(indentSize) || indentSize <= 0) return 2
    return indentSize
}

function formatParameter(parameter: SpecOperations.Parameter, optional: boolean) {
    return `${optional ? 'optional ' : ''}${parameter.name}${parameter.type ? `: ${formatSpecValueForHeader(parameter.type)}` : ''}`
}

function getOperationType(operation: BiblioOp | undefined) {
    if (!operation?.kind) return undefined
    return operation.kind === 'syntax-directed operation' ? 'sdo' : operation.kind
}

function formatClauseTitle(titleHTML: string) {
    return titleHTML.replace(/<var(?:\s[^>]*)?>/gu, '_').replace(/<\/var>/gu, '_')
}

function getLocalClauseNumber(clause: BiblioClause) {
    return clause.number.slice(clause.number.lastIndexOf('.') + 1)
}

function escapeAttribute(value: string) {
    return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
}
