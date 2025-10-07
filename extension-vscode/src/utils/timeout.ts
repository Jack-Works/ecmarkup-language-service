export function timeout<T>(promise: Promise<T>, timeout = 1000): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            reject(new Error('Operation timed out'))
        }, timeout)
        promise
            .then((res) => {
                clearTimeout(id)
                resolve(res)
            })
            .catch((err) => {
                clearTimeout(id)
                reject(err)
            })
    })
}
