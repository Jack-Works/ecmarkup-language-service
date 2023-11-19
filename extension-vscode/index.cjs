module.exports.activate = async function () {
    return (await import('./lib/node.js')).activate(...arguments)
}
module.exports.deactive = async function () {
    return (await import('./lib/node.js')).deactivate(...arguments)
}
