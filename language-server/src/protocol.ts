import type { Position, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver-types'

export const insertClauseRequest = 'ecmarkup/insertClause'

export interface InsertClauseParams {
    textDocument: TextDocumentIdentifier
    position: Position
    clauseNumber: string
    indentSize?: number
}

export type InsertClauseResult = TextEdit[] | null
