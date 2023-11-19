declare module '@tc39/ecma262-biblio' {
    export namespace SpecValue {
        export interface Completion {
            readonly kind: 'completion'
            readonly typeOfValueIfNormal: null | SpecDataType
            readonly completionType: 'mixed' | 'abrupt' | 'normal'
        }
        export interface Opaque {
            readonly kind: 'opaque'
            readonly type: string
        }
        export interface Union {
            readonly kind: 'union'
            readonly types: readonly SpecDataType[]
        }
        export interface List {
            readonly kind: 'list'
            readonly elements: SpecDataType
        }
        export interface Unused {
            readonly kind: 'unused'
        }
        export interface Record {
            readonly kind: 'record'
            readonly fields: RecordField
        }
        export interface RecordField {
            readonly [key: `[[${string}]]`]: SpecDataType
        }
        export type SpecDataType = Completion | Opaque | Union | List | Unused | Record
    }
    export namespace SpecOperations {
        export type Effects = 'user-code'
        export type OperationKind =
            | 'abstract operation'
            | 'numeric method'
            | 'syntax-directed operation'
            | 'host-defined abstract operation'
            | 'implementation-defined abstract operation'

        export interface Parameter {
            readonly name: `_${string}_`
            readonly type: SpecValue.SpecDataType | undefined
        }
        export interface OperationSignature {
            readonly parameters: readonly Parameter[]
            readonly optionalParameters: readonly Parameter[]
            readonly return: SpecValue.SpecDataType
        }
    }
    export interface BiblioClause {
        readonly type: 'clause'
        readonly id: string
        readonly aoid: string | null
        readonly title: string
        readonly titleHTML: string
        readonly number: string
    }
    export interface BiblioTerm {
        readonly type: 'term'
        readonly term: string
        readonly refId?: string | undefined
        readonly id?: string | undefined
        readonly variants?: readonly string[] | undefined
    }
    export interface BiblioFigure {
        readonly type: 'figure'
        readonly id: string
        readonly number: number
        readonly caption: string
    }
    export interface BiblioStep {
        readonly type: 'step'
        readonly id: string
        readonly stepNumbers: readonly number[]
    }
    export interface BiblioOp {
        readonly type: 'op'
        readonly aoid: string
        readonly effects: readonly SpecOperations.Effects[]
        readonly kind: SpecOperations.OperationKind | undefined
        readonly refId: string | undefined
        readonly signature: SpecOperations.OperationSignature | null
    }
    export interface BiblioTable {
        readonly type: 'table'
        readonly id: string
        readonly number: number
        readonly caption: string
    }
    export interface BiblioProduction {
        readonly type: 'production'
        readonly id: string
        readonly name: string
    }
    export interface BiblioNote {
        readonly type: 'note'
        readonly id: string
        readonly number: number
        readonly clauseId: string
    }
    export type BiblioEntry =
        | BiblioClause
        | BiblioTerm
        | BiblioFigure
        | BiblioStep
        | BiblioOp
        | BiblioTable
        | BiblioProduction
        | BiblioNote
    export interface Biblio {
        readonly location: string
        readonly entries: readonly BiblioEntry[]
    }
    const json: Biblio
    export default json
}
