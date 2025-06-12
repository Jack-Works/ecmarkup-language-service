export function lazy<C, T>(
    { get, set }: ClassAccessorDecoratorTarget<C, T>,
    _: unknown,
): ClassAccessorDecoratorResult<C, T> {
    const init: ((C: C) => T) | undefined = (C: C) => {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const f = get.call(C) as any
        initMap ||= new WeakSet()
        if (initMap.has(f)) {
            const val = f()
            set.call(C, val)
            return val
        } else return f
    }
    return {
        get(this: C) {
            return init(this)
        },
        set(this: C, val: T) {
            init(this)
            set.call(this, val)
        },
    }
}
let initMap: WeakSet<object>
/**
 * DO NOT use this function without the lazy decorator! It actually returning the init function instead of the value
 * @param init The init function
 */
lazy.of = <T>(init: (this: undefined) => T): T => {
    const f = Reflect.apply(Function.bind, init, [undefined])
    initMap ||= new WeakSet()
    initMap.add(f)
    return f
}
