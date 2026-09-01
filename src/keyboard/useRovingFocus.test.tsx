import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeyboardProvider } from './KeyboardProvider'
import { useRovingFocus } from './useRovingFocus'

function List({ items, onActivate }: { items: string[]; onActivate?: (item: string) => void }) {
  const { itemRef } = useRovingFocus({ id: 'list', count: items.length })
  return (
    <ul>
      {items.map((item, index) => (
        <li key={item}>
          <a
            href={`#${item}`}
            ref={itemRef(index)}
            onClick={(event) => {
              event.preventDefault()
              onActivate?.(item)
            }}
          >
            {item}
          </a>
        </li>
      ))}
    </ul>
  )
}

const setup = (items: string[], onActivate?: (item: string) => void) => {
  render(
    <KeyboardProvider>
      <List items={items} onActivate={onActivate} />
    </KeyboardProvider>,
  )
  return userEvent.setup()
}

describe('useRovingFocus', () => {
  const items = ['alpha', 'beta', 'gamma']

  it('enters the list at the first item on j', async () => {
    const user = setup(items)
    await user.keyboard('j')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('enters at the last item on k', async () => {
    const user = setup(items)
    await user.keyboard('k')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('moves down with j', async () => {
    const user = setup(items)
    await user.keyboard('jj')
    expect(screen.getByText('beta')).toHaveFocus()
  })

  it('moves up with k', async () => {
    const user = setup(items)
    await user.keyboard('jjk')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('wraps from the last item to the first', async () => {
    const user = setup(items)
    await user.keyboard('jjjj')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('wraps from the first item to the last', async () => {
    const user = setup(items)
    await user.keyboard('jk')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('jumps to the nth item by number', async () => {
    const user = setup(items)
    await user.keyboard('3')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('ignores a number beyond the list length', async () => {
    const user = setup(items)
    await user.keyboard('j9')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('activates the focused item on Enter', async () => {
    const onActivate = vi.fn()
    const user = setup(items, onActivate)
    await user.keyboard('jj')
    await user.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledWith('beta')
  })

  it('does nothing on an empty list', async () => {
    render(
      <KeyboardProvider>
        <List items={[]} />
      </KeyboardProvider>,
    )
    const user = userEvent.setup()
    await expect(user.keyboard('j')).resolves.not.toThrow()
  })
})
