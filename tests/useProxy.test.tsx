import {StrictMode, useEffect, useRef, useState} from 'react'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {proxy, snapshot} from 'valtio'
import {useProxy} from 'valtio/utils'

const state = proxy({nested: {count: 0}})

const Counter = () => {
    const store = useProxy(state)
    const nested = store.nested
    return (
        <>
            <div>count: {store.nested.count}</div>
            <button
                onClick={() => {
                    /* eslint-disable-next-line react-hooks/react-compiler */
                    nested.count++
                }}
            >
                button
            </button>
        </>
    )
}

describe('useProxy nested mutation', () => {
    it('mutates nested fields', async () => {
        render(
            <StrictMode>
                <Counter/>
            </StrictMode>,
        )
        await screen.findByText('count: 0')
        fireEvent.click(screen.getByText('button'))
        await screen.findByText('count: 1')
        fireEvent.click(screen.getByText('button'))
        await screen.findByText('count: 2')
    })
})

describe('useProxy additional cases', () => {
    it('handles nested arrays', async () => {
        const arrState = proxy({nested: {items: ['a']}})

        const List = () => {
            const store = useProxy(arrState)
            const items = store.nested.items
            return (
                <>
                    <div>items: {store.nested.items.join(',')}</div>
                    <button
                        onClick={() => {
                            items.push('b')
                        }}
                    >
                        add
                    </button>
                </>
            )
        }

        render(
            <StrictMode>
                <List/>
            </StrictMode>,
        )
        await screen.findByText('items: a')
        fireEvent.click(screen.getByText('add'))
        await screen.findByText('items: a,b')
    })

    it('mutates nested fields in effect', async () => {
        const effectState = proxy({nested: {count: 0}})

        const Comp = () => {
            const store = useProxy(effectState)
            const nested = store.nested
            useEffect(() => {
                // eslint-disable-next-line react-hooks/react-compiler
                nested.count++
            }, [nested])
            return <div>count: {store.nested.count}</div>
        }

        render(
            <StrictMode>
                <Comp/>
            </StrictMode>,
        )
        await screen.findByText('count: 2')
    })

    it('applies multiple shallow mutations in one handler', async () => {
        const simple = proxy({count: 0})
        const Handler = () => {
            const store = useProxy(simple)
            const handle = () => {
                // eslint-disable-next-line react-hooks/react-compiler
                ++store.count
                // eslint-disable-next-line react-hooks/react-compiler
                ++store.count
            }
            return (
                <>
                    <div>count: {store.count}</div>
                    <button onClick={handle}>inc</button>
                </>
            )
        }

        render(
            <StrictMode>
                <Handler/>
            </StrictMode>,
        )
        await screen.findByText('count: 0')
        fireEvent.click(screen.getByText('inc'))
        await screen.findByText('count: 2')
    })

    it('applies multiple deep mutations in one handler', async () => {
        const store = proxy({nested: {count: 0}})
        const Handler = () => {
            const $store = useProxy(store)
            const handle = () => {
                // eslint-disable-next-line react-hooks/react-compiler
                ++$store.nested.count
                // eslint-disable-next-line react-hooks/react-compiler
                ++$store.nested.count
            }
            return (
                <>
                    <div>count: {$store.nested.count}</div>
                    <button onClick={handle}>inc</button>
                </>
            )
        }

        render(
            <StrictMode>
                <Handler/>
            </StrictMode>,
        )
        await screen.findByText('count: 0')
        fireEvent.click(screen.getByText('inc'))
        await screen.findByText('count: 2')
    })

    it('re-destructures after collection mutation', async () => {
        const arrState = proxy({list: ['a']})
        const refs: any[] = []
        let valueAfterMutations: any

        const Comp = () => {
            const store = useProxy(arrState)
            const {list} = store

            const handle = () => {
                refs.push(list)
                list.push('b')
                const {list: listAgain} = store
                refs.push(listAgain)
                listAgain.push('c')
                list.push('d')
                expect(list).toBe(listAgain)
                expect(list.join(',')).toBe('a,b,c,d')
            }

            return (
                <>
                    <div>list: {store.list.join(',')}</div>
                    <button onClick={handle}>push</button>
                </>
            )
        }

        render(
            <StrictMode>
                <Comp/>
            </StrictMode>,
        )
        await screen.findByText('list: a')
        fireEvent.click(screen.getByText('push'))
        await screen.findByText('list: a,b,c,d')
        expect(refs[0]).toBe(refs[1])
    })
})

describe('useProxy reference stability', () => {
    it('returns same proxy when object unchanged', async () => {
        const stable = proxy({count: 0})
        const refs: object[] = []
        const Comp = () => {
            const store = useProxy(stable)
            refs.push(store)
            return (
                <>
                    <div>count: {store.count}</div>
                    <button
                        onClick={() => {
                            /* eslint-disable-next-line react-hooks/react-compiler */
                            ++store.count
                        }}
                    >
                        inc
                    </button>
                </>
            )
        }

        render(
            <StrictMode>
                <Comp/>
            </StrictMode>,
        )
        expect(refs[0]).toBe(refs[1])

        fireEvent.click(screen.getByText('inc'))
        await waitFor(() => refs.length >= 4)
        expect(refs[2]).toBe(refs[3])
        expect(refs[1]).toBe(refs[2])
    })
})


const useCommitCount = () => {
    const commitCountRef = useRef(1)
    useEffect(() => {
        commitCountRef.current += 1
    })
    return commitCountRef.current
}

it('simple counter', async () => {
    const obj = proxy({count: 0})

    const Counter = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>count: {snap.count}</div>
                <button onClick={() => ++snap.count}>button</button>
            </>
        )
    }

    const {unmount} = render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('count: 0')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 1')
    unmount()
})

it('no extra re-renders (commits)', async () => {
    const obj = proxy({count: 0, count2: 0})

    const Counter = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>
                    count: {snap.count} ({useCommitCount()})
                </div>
                <button onClick={() => ++snap.count}>button</button>
            </>
        )
    }

    const Counter2 = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>
                    count2: {snap.count2} ({useCommitCount()})
                </div>
                <button onClick={() => ++snap.count2}>button2</button>
            </>
        )
    }

    render(
        <>
            <Counter/>
            <Counter2/>
        </>,
    )

    await waitFor(() => {
        screen.getByText('count: 0 (1)')
        screen.getByText('count2: 0 (1)')
    })

    fireEvent.click(screen.getByText('button'))
    await waitFor(() => {
        screen.getByText('count: 1 (2)')
        screen.getByText('count2: 0 (1)')
    })

    fireEvent.click(screen.getByText('button2'))
    await waitFor(() => {
        screen.getByText('count: 1 (2)')
        screen.getByText('count2: 1 (2)')
    })
})

it('no extra re-renders (render func calls in non strict mode)', async () => {
    const obj = proxy({count: 0, count2: 0})

    const renderFn = vi.fn()
    const Counter = () => {
        const snap = useProxy(obj)
        renderFn(snap.count)
        return (
            <>
                <div>count: {snap.count}</div>
                <button onClick={() => ++snap.count}>button</button>
            </>
        )
    }

    const renderFn2 = vi.fn()
    const Counter2 = () => {
        const snap = useProxy(obj)
        renderFn2(snap.count2)
        return (
            <>
                <div>count2: {snap.count2}</div>
                <button onClick={() => ++snap.count2}>button2</button>
            </>
        )
    }

    render(
        <>
            <Counter/>
            <Counter2/>
        </>,
    )

    await waitFor(() => {
        screen.getByText('count: 0')
        screen.getByText('count2: 0')
    })
    expect(renderFn).toBeCalledTimes(1)
    expect(renderFn).lastCalledWith(0)
    expect(renderFn2).toBeCalledTimes(1)
    expect(renderFn2).lastCalledWith(0)

    fireEvent.click(screen.getByText('button'))
    await waitFor(() => {
        screen.getByText('count: 1')
        screen.getByText('count2: 0')
    })
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(1)
    expect(renderFn2).lastCalledWith(0)

    fireEvent.click(screen.getByText('button2'))
    await waitFor(() => {
        screen.getByText('count: 1')
        screen.getByText('count2: 1')
    })
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(2)
    expect(renderFn2).lastCalledWith(1)

    fireEvent.click(screen.getByText('button2'))
    await waitFor(() => {
        screen.getByText('count: 1')
        screen.getByText('count2: 2')
    })
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(3)
    expect(renderFn2).lastCalledWith(2)

    fireEvent.click(screen.getByText('button'))
    await waitFor(() => {
        screen.getByText('count: 2')
        screen.getByText('count2: 2')
    })
    expect(renderFn).toBeCalledTimes(3)
    expect(renderFn).lastCalledWith(2)
    expect(renderFn2).toBeCalledTimes(3)
    expect(renderFn2).lastCalledWith(2)
})

it('object in object', async () => {
    const obj = proxy({object: {count: 0}})

    const Counter = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>count: {snap.object.count}</div>
                <button onClick={() => ++snap.object.count}>button</button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('count: 0')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 1')
})

it('array in object', async () => {
    const obj = proxy({counts: [0, 1, 2]})

    const Counter = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>counts: {snap.counts.join(',')}</div>
                <button onClick={() => snap.counts.push(snap.counts.length)}>
                    button
                </button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('counts: 0,1,2')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('counts: 0,1,2,3')
})

it('array pop and splice', async () => {
    const arr = proxy([0, 1, 2])

    const Counter = () => {
        const snap = useProxy(arr)
        return (
            <>
                <div>counts: {snap.join(',')}</div>
                <button onClick={() => arr.pop()}>button</button>
                <button onClick={() => arr.splice(1, 0, 10, 11)}>button2</button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('counts: 0,1,2')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('counts: 0,1')

    fireEvent.click(screen.getByText('button2'))
    await screen.findByText('counts: 0,10,11,1')
})

it('array length after direct assignment', async () => {
    const obj = proxy({counts: [0, 1, 2]})

    const Counter = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>counts: {snap.counts.join(',')}</div>
                <div>length: {snap.counts.length}</div>
                <button
                    onClick={() => (snap.counts[snap.counts.length] = snap.counts.length)}
                >
                    increment
                </button>
                <button
                    onClick={() =>
                        (snap.counts[snap.counts.length + 5] = snap.counts.length + 5)
                    }
                >
                    jump
                </button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('counts: 0,1,2')

    fireEvent.click(screen.getByText('increment'))
    await screen.findByText('counts: 0,1,2,3')

    fireEvent.click(screen.getByText('jump'))
    await screen.findByText('counts: 0,1,2,3,,,,,,9')
})

it('deleting property', async () => {
    const obj = proxy<{ count?: number }>({count: 1})

    const Counter = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>count: {snap.count ?? 'none'}</div>
                <button onClick={() => delete snap.count}>button</button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('count: 1')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: none')
})

it('circular object', async () => {
    const obj = proxy<any>({object: {}})
    obj.object = obj
    obj.object.count = 0

    const Counter = () => {
        const snap = useProxy(obj) as any
        return (
            <>
                <div>count: {snap.count}</div>
                <button onClick={() => ++snap.count}>button</button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('count: 0')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 1')
})

it('circular object with non-proxy object (#375)', async () => {
    const initialObject = {count: 0}
    const state: any = proxy(initialObject)
    state.obj = initialObject

    const Counter = () => {
        const snap = useProxy(state)
        return <div>count: {snap.obj ? 1 : snap.count}</div>
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('count: 1')
})

it('render from outside', async () => {
    const obj = proxy({count: 0, anotherCount: 0})

    const Counter = () => {
        const [show, setShow] = useState(false)
        const snap = useProxy(obj)
        return (
            <>
                {show ? (
                    <div>count: {snap.count}</div>
                ) : (
                    <div>anotherCount: {snap.anotherCount}</div>
                )}
                <button onClick={() => ++snap.count}>button</button>
                <button onClick={() => setShow((x) => !x)}>toggle</button>
            </>
        )
    }

    render(
        <StrictMode>
            <Counter/>
        </StrictMode>,
    )

    await screen.findByText('anotherCount: 0')

    fireEvent.click(screen.getByText('button'))
    fireEvent.click(screen.getByText('toggle'))
    await screen.findByText('count: 1')
})

it('counter with sync option', async () => {
    const obj = proxy({count: 0})

    const Counter = () => {
        const snap = useProxy(obj, {sync: true})
        return (
            <>
                <div>
                    count: {snap.count} ({useCommitCount()})
                </div>
                <button onClick={() => ++snap.count}>button</button>
            </>
        )
    }

    render(
        <>
            <Counter/>
        </>,
    )

    await screen.findByText('count: 0 (1)')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 1 (2)')

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 2 (3)')
})

it('support undefined property (#439)', async () => {
    const obj = proxy({prop: undefined})

    expect('prop' in obj).toBe(true)

    const Component = () => {
        const snap = useProxy(obj)
        return <div>has prop: {JSON.stringify('prop' in snap)}</div>
    }

    render(
        <StrictMode>
            <Component/>
        </StrictMode>,
    )

    await screen.findByText('has prop: true')
})

it('sync snapshot between nested components (#460)', async () => {
    const obj = proxy<{
        id: 'prop1' | 'prop2'
        prop1: string
        prop2?: string
    }>({id: 'prop1', prop1: 'value1'})

    const Child = ({id}: { id: 'prop1' | 'prop2' }) => {
        const snap = useProxy(obj)
        return <div>Child: {snap[id]}</div>
    }

    const handleClick = () => {
        obj.prop2 = 'value2'
        obj.id = 'prop2'
    }

    const Parent = () => {
        const snap = useProxy(obj)
        return (
            <>
                <div>Parent: {snap[snap.id]}</div>
                <Child id={snap.id}/>
                <button onClick={handleClick}>button</button>
            </>
        )
    }

    render(
        <StrictMode>
            <Parent/>
        </StrictMode>,
    )

    await waitFor(() => {
        screen.getByText('Parent: value1')
        screen.getByText('Child: value1')
    })

    fireEvent.click(screen.getByText('button'))
    await waitFor(() => {
        screen.getByText('Parent: value2')
        screen.getByText('Child: value2')
    })
})

it('respects property enumerability (#726)', async () => {
    const x = proxy(Object.defineProperty({a: 1}, 'b', {value: 2}))
    expect(Object.keys(snapshot(x))).toEqual(Object.keys(x))
})

it('stable snapshot object (#985)', async () => {
    const state = proxy({count: 0, obj: {}})

    let effectCount = 0

    const TestComponent = () => {
        const {count, obj} = useProxy(state)
        useEffect(() => {
            ++effectCount
        }, [obj])
        return (
            <>
                <div>count: {count}</div>
                <button onClick={() => ++state.count}>button</button>
            </>
        )
    }

    render(<TestComponent/>)

    await screen.findByText('count: 0')
    expect(effectCount).toBe(1)

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 1')
    expect(effectCount).toBe(1)

    fireEvent.click(screen.getByText('button'))
    await screen.findByText('count: 2')
    expect(effectCount).toBe(1)
})


describe('TodoList with child Todo components', () => {
    it('each Todo mutates only its own proxy', async () => {
        type TodoType = { text: string; checked: boolean }
        const todos = proxy<TodoType[]>([
            { text: 'Task1', checked: false },
            { text: 'Task2', checked: false },
        ])

        const Todo = ({ todo }: { todo: TodoType }) => {
            return (
                <li>
                    <label htmlFor={todo.text}>{todo.text} - {todo.checked ? 'done' : 'pending'}</label>
                    <button id={todo.text} onClick={() => (todo.checked = !todo.checked)}>
                        toggle
                    </button>
                </li>
            )
        }

        const TodoList = () => {
            const snap = useProxy(todos)
            return (
                <ul>
                    {snap.map((todo, idx) => (
                        <Todo key={idx} todo={todo as any} />
                    ))}
                </ul>
            )
        }

        render(
            <StrictMode>
                <TodoList />
            </StrictMode>,
        )

        // Verify initial state
        await screen.findByText('Task1 - pending')
        await screen.findByText('Task2 - pending')

        // Toggle first todo
        fireEvent.click(screen.getByText('toggle', { selector: '#Task1' }))

        // First todo updated, second unchanged
        await screen.findByText('Task1 - done')
        await screen.findByText('Task2 - pending')

        // Toggle second todo
        fireEvent.click(screen.getByText('toggle', { selector: '#Task2' }))

        // Both todos updated
        await screen.findByText('Task1 - done')
        await screen.findByText('Task2 - done')
    })
})
