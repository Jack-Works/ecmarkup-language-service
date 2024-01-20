import * as html from 'vscode-html-languageservice'
import * as grammarkdown from 'grammarkdown'
export const { TextDocument } = html.default || html
export type TextDocument = html.TextDocument

export const { Parser, NodeVisitor } = grammarkdown.default || grammarkdown
export type Parser = grammarkdown.Parser
export type NodeVisitor = grammarkdown.NodeVisitor
