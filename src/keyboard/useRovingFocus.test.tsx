import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeyboardProvider } from './KeyboardProvider'
import { useRovingFocus } from './useRovingFocus'

function List({
  id = 'list',
  items,
  grid = false,
  onActivate,
}: {
  id?: string
  items: string[]
  grid?: boolean
  onActivate?: (item: string) => void
}) {
  const { itemRef, listProps } = useRovingFocus({ id, count: items.length, grid })
  return (
    <ul {...listProps}>
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

/** jsdom has no layout, so lay the items out ourselves: `columns` per row. */
function layout(items: string[], columns: number) {
  items.forEach((item, index) => {
    place(screen.getByText(item), Math.floor(index / columns), index % columns)
  })
}

function place(element: HTMLElement, row: number, column: number) {
  Object.defineProperty(element, 'offsetTop', { value: row * 100, configurable: true })
  Object.defineProperty(element, 'offsetLeft', { value: column * 100, configurable: true })
}

describe('useRovingFocus', () => {
  const items = ['alpha', 'beta', 'gamma']

  it('enters the list at the first item on ArrowDown', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('enters at the last item on ArrowUp', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowUp}')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('moves down with ArrowDown', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByText('beta')).toHaveFocus()
  })

  it('moves up with ArrowUp', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('wraps from the last item to the first', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('wraps from the first item to the last', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}{ArrowUp}')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('no longer answers to j and k', async () => {
    const user = setup(items)
    await user.keyboard('jk')
    expect(document.body).toHaveFocus()
  })

  it('leaves left and right alone in a plain list', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}{ArrowRight}')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('jumps to the nth item by number', async () => {
    const user = setup(items)
    await user.keyboard('3')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('ignores a number beyond the list length', async () => {
    const user = setup(items)
    await user.keyboard('{ArrowDown}9')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('activates the focused item on Enter', async () => {
    const onActivate = vi.fn()
    const user = setup(items, onActivate)
    await user.keyboard('{ArrowDown}{ArrowDown}')
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
    await expect(user.keyboard('{ArrowDown}')).resolves.not.toThrow()
  })

  describe('grid', () => {
    const cells = ['a', 'b', 'c', 'd', 'e']

    const setupGrid = (columns: number) => {
      render(
        <KeyboardProvider>
          <List items={cells} grid />
        </KeyboardProvider>,
      )
      layout(cells, columns)
      return userEvent.setup()
    }

    it('moves across with ArrowRight and ArrowLeft', async () => {
      const user = setupGrid(2)
      await user.keyboard('{ArrowRight}{ArrowRight}')
      expect(screen.getByText('b')).toHaveFocus()
      await user.keyboard('{ArrowLeft}')
      expect(screen.getByText('a')).toHaveFocus()
    })

    it('wraps horizontally', async () => {
      const user = setupGrid(2)
      await user.keyboard('{ArrowRight}{ArrowLeft}')
      expect(screen.getByText('e')).toHaveFocus()
    })

    it('moves a full row with ArrowDown and ArrowUp', async () => {
      const user = setupGrid(2)
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}')
      expect(screen.getByText('d')).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(screen.getByText('b')).toHaveFocus()
    })

    it('lands on the last item when the row below is short', async () => {
      const user = setupGrid(2)
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}')
      expect(screen.getByText('e')).toHaveFocus()
    })

    it('stops at the top and bottom rows instead of wrapping', async () => {
      const user = setupGrid(2)
      await user.keyboard('{ArrowRight}{ArrowUp}')
      expect(screen.getByText('a')).toHaveFocus()
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
      expect(screen.getByText('e')).toHaveFocus()
    })

    it('moves to the item directly beneath, whatever the column count', async () => {
      const user = setupGrid(3)
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}')
      expect(screen.getByText('e')).toHaveFocus()
    })

    it('walks from full-width rows into a multi-column grid and back', async () => {
      render(
        <KeyboardProvider>
          <List items={['row1', 'row2', 'g1', 'g2', 'g3']} grid />
        </KeyboardProvider>,
      )
      place(screen.getByText('row1'), 0, 0)
      place(screen.getByText('row2'), 1, 0)
      place(screen.getByText('g1'), 2, 0)
      place(screen.getByText('g2'), 2, 1)
      place(screen.getByText('g3'), 2, 2)
      const user = userEvent.setup()
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
      expect(screen.getByText('g1')).toHaveFocus()
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowUp}')
      expect(screen.getByText('row2')).toHaveFocus()
    })
  })

  describe('two lists on one page', () => {
    const setupPair = () => {
      render(
        <KeyboardProvider>
          <List id="first" items={['one', 'two']} />
          <List id="second" items={['three', 'four']} />
        </KeyboardProvider>,
      )
      return userEvent.setup()
    }

    it('enters the first list when nothing is focused', async () => {
      const user = setupPair()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByText('one')).toHaveFocus()
    })

    it('keeps moving within whichever list has focus', async () => {
      const user = setupPair()
      screen.getByText('three').focus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByText('four')).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByText('three')).toHaveFocus()
    })
  })
})
