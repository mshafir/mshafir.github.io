import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { KeyboardProvider, useKeyboardScope, useActiveBindings } from './KeyboardProvider'
import type { Binding } from './types'

function Scope({
  id,
  bindings,
  children,
}: {
  id: string
  bindings: Binding[]
  children?: ReactNode
}) {
  useKeyboardScope({ id, bindings })
  return <>{children}</>
}

function BindingList() {
  const bindings = useActiveBindings()
  return (
    <ul>
      {bindings.map((b) => (
        <li key={b.keys}>{`${b.keys}:${b.label}`}</li>
      ))}
    </ul>
  )
}

describe('KeyboardProvider', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  it('fires a single-stroke binding', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: '?', label: 'help', action }]} />
      </KeyboardProvider>,
    )
    await user().keyboard('?')
    expect(action).toHaveBeenCalledOnce()
  })

  it('fires a chord binding only after the full sequence', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'g h', label: 'home', action }]} />
      </KeyboardProvider>,
    )
    const u = user()
    await u.keyboard('g')
    expect(action).not.toHaveBeenCalled()
    await u.keyboard('h')
    expect(action).toHaveBeenCalledOnce()
  })

  it('abandons a chord after the timeout', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'g h', label: 'home', action }]} />
      </KeyboardProvider>,
    )
    const u = user()
    await u.keyboard('g')
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    await u.keyboard('h')
    expect(action).not.toHaveBeenCalled()
  })

  it('lets a higher scope shadow a lower one', async () => {
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="outer" bindings={[{ keys: 'x', label: 'outer', action: outer }]}>
          <Scope id="inner" bindings={[{ keys: 'x', label: 'inner', action: inner }]} />
        </Scope>
      </KeyboardProvider>,
    )
    await user().keyboard('x')
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
  })

  it('falls through to a lower scope for unclaimed keys', async () => {
    const outer = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="outer" bindings={[{ keys: 'y', label: 'outer', action: outer }]}>
          <Scope id="inner" bindings={[{ keys: 'x', label: 'inner', action: vi.fn() }]} />
        </Scope>
      </KeyboardProvider>,
    )
    await user().keyboard('y')
    expect(outer).toHaveBeenCalledOnce()
  })

  it('restores the lower scope when the upper unmounts', async () => {
    const outer = vi.fn()
    function Toggle({ show }: { show: boolean }) {
      return (
        <KeyboardProvider>
          <Scope id="outer" bindings={[{ keys: 'x', label: 'outer', action: outer }]}>
            {show ? (
              <Scope id="inner" bindings={[{ keys: 'x', label: 'inner', action: vi.fn() }]} />
            ) : null}
          </Scope>
        </KeyboardProvider>
      )
    }
    const { rerender } = render(<Toggle show />)
    rerender(<Toggle show={false} />)
    await user().keyboard('x')
    expect(outer).toHaveBeenCalledOnce()
  })

  it('does not fire while typing in an input', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'x', label: 'x', action }]} />
        <input aria-label="field" />
      </KeyboardProvider>,
    )
    const u = user()
    await u.click(screen.getByLabelText('field'))
    await u.keyboard('x')
    expect(action).not.toHaveBeenCalled()
  })

  it('fires in an input when the binding opts in', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope
          id="s"
          bindings={[{ keys: 'Escape', label: 'close', action, allowInInput: true }]}
        />
        <input aria-label="field" />
      </KeyboardProvider>,
    )
    const u = user()
    await u.click(screen.getByLabelText('field'))
    await u.keyboard('{Escape}')
    expect(action).toHaveBeenCalledOnce()
  })

  it('registers nothing when disabled', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider enabled={false}>
        <Scope id="s" bindings={[{ keys: 'x', label: 'x', action }]} />
      </KeyboardProvider>,
    )
    await user().keyboard('x')
    expect(action).not.toHaveBeenCalled()
  })

  it('exposes active bindings with the topmost scope first', () => {
    render(
      <KeyboardProvider>
        <Scope id="outer" bindings={[{ keys: 'y', label: 'outer-y', action: vi.fn() }]}>
          <Scope id="inner" bindings={[{ keys: 'x', label: 'inner-x', action: vi.fn() }]}>
            <BindingList />
          </Scope>
        </Scope>
      </KeyboardProvider>,
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'x:inner-x',
      'y:outer-y',
    ])
  })

  it('omits hidden bindings from the active list', () => {
    render(
      <KeyboardProvider>
        <Scope
          id="s"
          bindings={[
            { keys: 'x', label: 'shown', action: vi.fn() },
            { keys: 'q', label: 'secret', action: vi.fn(), hidden: true },
          ]}
        >
          <BindingList />
        </Scope>
      </KeyboardProvider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
