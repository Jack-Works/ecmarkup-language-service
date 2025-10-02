import { fileURLToPath } from 'node:url'

/** @type {import('webpack').Configuration} */
const config = {
    mode: 'production',
    devtool: 'source-map',
    entry: {
        node: './src/node.ts',
        'language-server-node': './node_modules/ecmarkup-language-server/src/server-node.ts',
    },
    output: {
        path: fileURLToPath(new URL('./lib', import.meta.url)),
        filename: '[name].js',
        library: { type: 'module' },
        module: true,
    },
    experiments: { outputModule: true },
    resolve: {
        alias: {
            jsdom: fileURLToPath(new URL('./scripts/null.cjs', import.meta.url)),
            chalk: fileURLToPath(new URL('./scripts/null.cjs', import.meta.url)),
        },
        extensions: ['.ts', '.tsx', '.js'],
        extensionAlias: {
            '.js': ['.js', '.ts'],
            '.cjs': ['.cjs', '.cts'],
            '.mjs': ['.mjs', '.mts'],
        },
    },
    externals: { vscode: 'module vscode', child_process: 'module child_process' },
    module: {
        rules: [
            { test: /\.([cm]?ts|tsx)$/, loader: 'ts-loader', options: { transpileOnly: true } },
            { test: /\.grammar/, type: 'asset/resource' },
        ],
    },
    optimization: {
        minimize: false,
        moduleIds: 'named',
    },
    target: 'node',
}
;['crypto', 'child_process', 'fs', 'net', 'os', 'path', 'util', 'fs/promises', 'perf_hooks', 'url'].forEach((mod) => {
    // @ts-ignore
    config.externals[mod] = `module node:${mod}`
    // @ts-ignore
    config.externals[`node:${mod}`] = `module node:${mod}`
})
export default config
