const fs = require('node:fs')
const path = require('node:path')

const defaultStyleSheetPattern = /const defaultStyleSheet = fs\.readFileSync\(\s*path\.resolve\(__dirname,\s*["']\.\.\/\.\.\/\.\.\/browser\/default-stylesheet\.css["']\s*\)\s*,\s*\{\s*encoding:\s*["']utf-8["']\s*\}\s*\);/

module.exports = function jsdomCssLoader(source) {
    if (!defaultStyleSheetPattern.test(source)) {
        throw new Error(`Could not find jsdom's default stylesheet loader in ${this.resourcePath}`)
    }

    const stylesheetPath = path.resolve(
        path.dirname(this.resourcePath),
        '../../../browser/default-stylesheet.css',
    )
    const stylesheet = fs.readFileSync(stylesheetPath, 'utf8')

    return source.replace(
        defaultStyleSheetPattern,
        `const defaultStyleSheet = ${JSON.stringify(stylesheet)};`,
    )
}
