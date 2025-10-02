module.exports = new Proxy({}, {
    get: (_target, _prop) => () => {
        throw new Error('This module is emitted from the bundle')
    },
})
