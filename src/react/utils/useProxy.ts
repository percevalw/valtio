import { useLayoutEffect, useRef } from 'react'
import { useSnapshot } from '../../react.ts'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

const DUMMY_SYMBOL = Symbol()

/**
 * useProxy
 *
 * Takes a proxy and returns a new proxy which you can use in both react render
 * and in callbacks. The root reference is replaced on every render, but the
 * keys (and subkeys) below it are stable until they're intentionally mutated.
 * For the best ergonomics, you can export a custom hook from your store, so you
 * don't have to figure out a separate name for the hook reference. E.g.:
 *
 * export const store = proxy(initialState)
 * export const useStore = () => useProxy(store)
 * // in the component file:
 * function Cmp() {
 *   const store = useStore()
 *   return <button onClick={() => {store.count++}}>{store.count}</button>
 * }
 *
 * @param proxy
 * @param options
 * @returns A new proxy which you can use in the render as well as in callbacks.
 */
export function useProxy<T extends object>(
  proxy: T,
  options?: NonNullable<Parameters<typeof useSnapshot>[1]>,
): T {
  const snapshot = useSnapshot(proxy, options) as T

  // touch dummy prop so that it doesn't trigger re-renders when no props are touched.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  ;(snapshot as any)[DUMMY_SYMBOL]

  const isRenderingRef = useRef(true)
  isRenderingRef.current = true
  useLayoutEffect(() => {
    // This is an intentional hack
    // It might not work with React Compiler

    isRenderingRef.current = false
  })

  const cacheRef = useRef(new WeakMap<object, { proxy: any; snap: any }>())

  const createDeepProxy = (targetObj: any, snapObj: any): any => {
    if (!isObject(targetObj)) {
      return isRenderingRef.current ? snapObj : targetObj
    }
    let cached = cacheRef.current.get(targetObj)
    if (!cached) {
      cached = { snap: snapObj, proxy: undefined as unknown as any }
      cached.proxy = new Proxy(targetObj, {
        get(t, p) {
          const childTarget = (t as any)[p]
          const childSnap = cached!.snap?.[p]
          return createDeepProxy(childTarget, childSnap)
        },
      })
      cacheRef.current.set(targetObj, cached)
    } else {
      cached.snap = snapObj
    }
    return cached.proxy
  }

  return createDeepProxy(proxy, snapshot) as T
}
