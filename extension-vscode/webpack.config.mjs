import { fileURLToPath } from 'node:url'

/** @type {import('webpack').Configuration} */
const config = {
    mode: 'production',
    devtool: 'source-map',
    entry: {
        node: './src/node.ts',
        ['language-server-node']: './node_modules/ecmarkup-language-server/src/server-node.ts',
    },
    output: {
        path: fileURLToPath(new URL('./lib', import.meta.url)),
        library: { type: 'commonjs' },
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        extensionAlias: {
            '.js': ['.js', '.ts'],
            '.cjs': ['.cjs', '.cts'],
            '.mjs': ['.mjs', '.mts'],
        },
    },
    externals: { vscode: 'commonjs vscode' },
    module: {
        rules: [
            { test: /\.([cm]?ts|tsx)$/, loader: 'ts-loader', options: { transpileOnly: true } },
            { test: /\.grammar/, type: 'asset/resource' },
        ],
    },
    optimization: {
        minimize: false,
    },
    target: 'node',
}
export default config
