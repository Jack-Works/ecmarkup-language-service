// Not in the biblio file, we use it to distinguish the source of the entry
declare module '@tc39/ecma262-biblio' {
    export interface Source {
        readonly location?: string | undefined
        readonly source?: string | undefined
        readonly local?: boolean | undefined
    }
    export interface BiblioClause extends Source {}
    export interface BiblioTerm extends Source {}
    export interface BiblioFigure extends Source {}
    export interface BiblioStep extends Source {}
    export interface BiblioOp extends Source {}
    export interface BiblioTable extends Source {}
    export interface BiblioProduction extends Source {}
    export interface BiblioNote extends Source {}
}
