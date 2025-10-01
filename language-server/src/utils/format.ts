import type { BiblioEntry, BiblioOp, SpecOperations, SpecValue } from '@tc39/ecma262-biblio'
import { type MarkupContent, MarkupKind } from 'vscode-languageserver-types'
import { getURL } from './biblio.js'

function formatSignature({ aoid, signature }: BiblioOp): string {
    if (!signature) return aoid
    let str = aoid + '('
    if (signature.parameters.length || signature.optionalParameters.length) {
        str += '\n  '
        str += [...signature.parameters, ...signature.optionalParameters]
            .map((x) => formatParameter(x, signature.optionalParameters.includes(x)))
            .join(',\n  ')
        str += '\n'
    }
    str += '): ' + formatSpecValue(signature.return, 0)
    return str
}
function formatParameter(value: SpecOperations.Parameter, optional: boolean): string {
    let str = value.name.slice(1, -1)
    if (optional) str += '?'
    if (value.type) str += ': ' + formatSpecValue(value.type, 2)
    return str
}
function formatSpecValue(value: SpecValue.SpecDataType, identLevel: number): string {
    if (value.kind === 'completion') {
        if (!value.typeOfValueIfNormal) return Cap(value.completionType) + 'Completion'
        return `Completion<${formatSpecValue(value.typeOfValueIfNormal, identLevel)}>`
    } else if (value.kind === 'list') {
        return `List<${formatSpecValue(value.elements, identLevel)}>`
    } else if (value.kind === 'opaque') {
        return value.type
            .replace(/^an? /, '')
            .replace('ECMAScript language value', 'Value')
            .replace('ECMAScript ', '')
            .replace('function object', 'Function')
            .replace(/(\w+) Record/, '$1')
            .replace('*undefined*', 'undefined')
            .replace('*false*', 'false')
            .replace('property key', 'PropertyKey')
    } else if (value.kind === 'unused') {
        return 'unused'
    } else if (value.kind === 'union') {
        return value.types.map(formatSpecValue).join(' | ')
    } else if (value.kind === 'record') {
        return `Record { ${Object.entries(value.fields)
            .map(([key, value]) => `${key}: ${formatSpecValue(value, identLevel)}`)
            .join(', ')} }`
    }
    throw new Error(`Unknown SpecValue: ${JSON.stringify(value)}`)
}
function Cap(x: string): string {
    return x[0]!.toUpperCase() + x.slice(1)
}
export function formatDocument(
    entry: BiblioEntry,
    supportedFormats: MarkupKind[] | undefined,
): MarkupContent | undefined {
    const supportMarkdown = supportedFormats?.includes(MarkupKind.Markdown)
    const url = getURL(entry)
    if (entry.type === 'clause') {
        if (supportMarkdown) {
            return { kind: MarkupKind.Markdown, value: `${entry.title}\n\n[${url}](${url})` }
        } else {
            return { kind: MarkupKind.PlainText, value: `${entry.title}\n${url}` }
        }
    } else if (entry.type === 'production') {
        if (entry.local) return { kind: MarkupKind.PlainText, value: entry.name }
        if (!url) return undefined
        if (supportMarkdown) {
            return { kind: MarkupKind.Markdown, value: `[${url}](${url})` }
        } else {
            return { kind: MarkupKind.PlainText, value: url }
        }
    } else if (entry.type === 'op') {
        let document = ''
        if (url) {
            document += supportMarkdown ? `[${url}](${url})` : url
        }
        if (entry.effects.includes('user-code'))
            document +=
                (document.length ? (supportMarkdown ? '\n\n' : '\n') : '') +
                'This abstract operation may triggers user code.'
        const signature = formatSignature(entry)
        if (supportMarkdown) {
            return { kind: MarkupKind.Markdown, value: '```ts\n' + signature + '\n```\n\n' + document }
        } else {
            return { kind: MarkupKind.PlainText, value: signature + '\n' + document }
        }
    } else if (entry.type === 'term') {
        if (!url) return undefined
        if (supportMarkdown) {
            return { kind: MarkupKind.Markdown, value: `[${url}](${url})` }
        } else {
            return { kind: MarkupKind.PlainText, value: url }
        }
    }
    return undefined
}
