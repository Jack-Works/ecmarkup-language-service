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
    str += '): ' + formatSpecValueForHover(signature.return)
    return str
}
function formatParameter(value: SpecOperations.Parameter, optional: boolean): string {
    let str = value.name.slice(1, -1)
    if (optional) str += '?'
    if (value.type) str += ': ' + formatSpecValueForHover(value.type)
    return str
}
function formatSpecValueForHover(value: SpecValue.SpecDataType): string {
    if (value.kind === 'completion') {
        if (!value.typeOfValueIfNormal) return Cap(value.completionType) + 'Completion'
        return `Completion<${formatSpecValueForHover(value.typeOfValueIfNormal)}>`
    } else if (value.kind === 'list') {
        return `List<${formatSpecValueForHover(value.elements)}>`
    } else if (value.kind === 'opaque') {
        return formatSpecValueText(value.type)
    } else if (value.kind === 'unused') {
        return 'unused'
    } else if (value.kind === 'union') {
        return value.types.map(formatSpecValueForHover).join(' | ')
    } else if (value.kind === 'record') {
        return `Record { ${Object.entries(value.fields)
            .map(([key, value]) => `${key}: ${formatSpecValueForHover(value)}`)
            .join(', ')} }`
    }
    throw new Error(`Unknown SpecValue: ${JSON.stringify(value)}`)
}

export function formatSpecValueForHeader(value: SpecValue.SpecDataType | undefined, operationName?: string): string {
    if (!value) return ''
    if (value.kind === 'completion') {
        if (value.completionType === 'normal') return 'a normal completion'
        if (value.completionType === 'abrupt') {
            if (operationName === 'ThrowCompletion') return 'a throw completion'
            if (operationName === 'ReturnCompletion') return 'a return completion'
            return 'an abrupt completion'
        }
        const normal = value.typeOfValueIfNormal
            ? ` containing ${value.typeOfValueIfNormal.kind === 'union' ? 'either ' : ''}${formatSpecValueForHeader(value.typeOfValueIfNormal)}`
            : ''
        return `either a normal completion${normal} or a throw completion`
    }
    if (value.kind === 'opaque') return value.type
    if (value.kind === 'unused') return '~unused~'
    if (value.kind === 'union') return joinWithOr(value.types.map((type) => formatSpecValueForHeader(type)))
    if (value.kind === 'list') return `a List of ${removeArticle(formatSpecValueForHeader(value.elements))}`
    if (value.kind === 'record') {
        const fields = Object.entries(value.fields)
            .map(([name, field]) => `${name}: ${formatSpecValueForHeader(field)}`)
            .join(', ')
        return `a Record with fields { ${fields} }`
    }
    return assertNever(value)
}

function removeArticle(value: string) {
    return value.replace(/^an? /u, '')
}

function joinWithOr(values: readonly string[]) {
    if (values.length < 2) return values[0] ?? ''
    return `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`
}

function assertNever(value: never): never {
    throw new Error(`Unknown spec value: ${JSON.stringify(value)}`)
}

export function formatSpecValueText(text: string) {
    return (
        text
            .replace(/^an? /, '')

            // Note: remove those if we parse AOs by ecmarkup in the future
            .replace(
                /either a normal completion containing (.+) or an abrupt completion/g,
                'NormalCompletion<$1> | AbruptCompletion',
            )
            .replace(
                /either a normal completion containing (.+) or a throw completion/g,
                'NormalCompletion<$1> | ThrowCompletion',
            )
            .replaceAll('~unused~', 'unused')

            .replaceAll('ECMAScript language value', 'Value')
            .replaceAll('ECMAScript ', '')
            .replaceAll('function object', 'Function')
            .replaceAll(/(\w+) Record/g, '$1')
            .replaceAll('*undefined*', 'undefined')
            .replaceAll('*false*', 'false')
            .replaceAll('property key', 'PropertyKey')
    )
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
