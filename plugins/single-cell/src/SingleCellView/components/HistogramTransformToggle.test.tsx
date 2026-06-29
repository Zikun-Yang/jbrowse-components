import { fireEvent, render } from '@testing-library/react'

import HistogramTransformToggle from './HistogramTransformToggle.tsx'

describe('HistogramTransformToggle', () => {
  it('renders four transform buttons', () => {
    const onChange = jest.fn()
    const { getAllByText } = render(
      <HistogramTransformToggle
        xTransform="linear"
        yTransform="linear"
        onChange={onChange}
      />,
    )
    expect(getAllByText('linear').length).toBe(2)
    expect(getAllByText('log').length).toBe(2)
  })

  it('calls onChange when clicking an inactive transform', () => {
    const onChange = jest.fn()
    const { getAllByText } = render(
      <HistogramTransformToggle
        xTransform="linear"
        yTransform="linear"
        onChange={onChange}
      />,
    )
    const logButtons = getAllByText('log')
    expect(logButtons.length).toBe(2)
    fireEvent.click(logButtons[0]!)
    expect(onChange).toHaveBeenCalledWith('x', 'log')
  })

  it('does not call onChange when clicking the active transform', () => {
    const onChange = jest.fn()
    const { getAllByText } = render(
      <HistogramTransformToggle
        xTransform="linear"
        yTransform="log"
        onChange={onChange}
      />,
    )
    const linearButtons = getAllByText('linear')
    fireEvent.click(linearButtons[0]!)
    expect(onChange).not.toHaveBeenCalled()
  })
})
