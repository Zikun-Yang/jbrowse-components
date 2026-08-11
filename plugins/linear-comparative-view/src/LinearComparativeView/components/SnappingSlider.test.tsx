import { useState } from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import SnappingSlider, { snapToTick } from './SnappingSlider.tsx'

const VALUES = [0, 5, 10, 50]

function Harness({
  values = VALUES,
  initial = 5,
  onChangeCommitted = jest.fn(),
  onChange,
  toPos,
  fromPos,
}: {
  values?: number[]
  initial?: number
  onChangeCommitted?: (v: number) => void
  onChange?: (v: number) => void
  toPos?: (v: number) => number
  fromPos?: (p: number) => number
}) {
  const [value, setValue] = useState(initial)
  return (
    <SnappingSlider
      label="Test:"
      values={values}
      value={value}
      onChange={v => {
        onChange?.(v)
      }}
      onChangeCommitted={v => {
        setValue(v)
        onChangeCommitted(v)
      }}
      format={v => `${v}`}
      toPos={toPos}
      fromPos={fromPos}
    />
  )
}

test('snapToTick snaps within the magnetic radius only', () => {
  const ticks = [0, 5, 10, 50]
  expect(snapToTick(5.4, ticks, 1)).toBe(5)
  expect(snapToTick(9.5, ticks, 1)).toBe(10)
  expect(snapToTick(6.5, ticks, 1)).toBe(6.5)
  expect(snapToTick(30, ticks, 1)).toBe(30)
  // snaps to the closest tick when two are in range
  expect(snapToTick(4.9, ticks, 5.5)).toBe(5)
})

test('renders label and current value without mark labels', () => {
  render(<Harness />)
  expect(screen.getByText('Test:')).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('5')
  expect(screen.queryByText('50')).not.toBeInTheDocument()
})

test('keyboard arrows move between key values', () => {
  const onChange = jest.fn()
  const onChangeCommitted = jest.fn()
  render(<Harness onChange={onChange} onChangeCommitted={onChangeCommitted} />)
  const thumb = screen.getByRole('slider')
  expect(thumb).toHaveAttribute('aria-valuenow', '5')

  fireEvent.keyDown(thumb, { key: 'ArrowRight' })
  expect(onChange).toHaveBeenCalledWith(10)

  fireEvent.keyDown(thumb, { key: 'ArrowRight' })
  expect(onChange).toHaveBeenCalledWith(50)
})

test('off-key current value sits at its true position', () => {
  render(<Harness initial={7} />)
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '7')
  expect(screen.getByRole('textbox')).toHaveValue('7')
})

test('log transform spaces ticks by magnitude', () => {
  const toPos = (v: number) => Math.log10(v + 10)
  const fromPos = (p: number) => 10 ** p - 10
  render(
    <Harness
      values={[0, 100, 1000, 100000]}
      initial={1000}
      toPos={toPos}
      fromPos={fromPos}
    />,
  )
  const thumb = screen.getByRole('slider')
  expect(Number(thumb.getAttribute('aria-valuemin'))).toBeCloseTo(1)
  expect(Number(thumb.getAttribute('aria-valuemax'))).toBeCloseTo(5)
  expect(Number(thumb.getAttribute('aria-valuenow'))).toBeCloseTo(
    Math.log10(1010),
  )
})

test('manual input commits arbitrary values without snapping', () => {
  const onChangeCommitted = jest.fn()
  render(<Harness onChangeCommitted={onChangeCommitted} />)
  const input = screen.getByRole('textbox')

  fireEvent.change(input, { target: { value: '42' } })
  fireEvent.blur(input)
  expect(onChangeCommitted).toHaveBeenCalledWith(42)
  expect(input).toHaveValue('42')
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '42')
})

test('garbage input reverts to the current value', () => {
  const onChangeCommitted = jest.fn()
  render(<Harness onChangeCommitted={onChangeCommitted} />)
  const input = screen.getByRole('textbox')

  fireEvent.change(input, { target: { value: 'abc' } })
  fireEvent.blur(input)
  expect(onChangeCommitted).not.toHaveBeenCalled()
  expect(input).toHaveValue('5')
})

test('out-of-range input clamps to the key value range', () => {
  const onChangeCommitted = jest.fn()
  render(<Harness onChangeCommitted={onChangeCommitted} />)
  const input = screen.getByRole('textbox')

  fireEvent.change(input, { target: { value: '999' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChangeCommitted).toHaveBeenCalledWith(50)
  expect(input).toHaveValue('50')
})

test('escape restores the current value', () => {
  render(<Harness />)
  const input = screen.getByRole('textbox')

  fireEvent.change(input, { target: { value: '33' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input).toHaveValue('5')
})
