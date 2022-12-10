declare module NodeJS {
    export interface ProcessEnv {
        NODE_ENV: 'production' | 'development'
    }
}
