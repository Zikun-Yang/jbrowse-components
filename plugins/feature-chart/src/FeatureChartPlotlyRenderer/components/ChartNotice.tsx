import type { ReactNode } from 'react'

/**
 * The yellow panel every renderer shows when a chart cannot be drawn: too many
 * charts, an unknown drawer, an invalid spec, a canvas-only drawer on the
 * Plotly backend.
 *
 * One component so those four cases look identical in both backends and in the
 * maximize dialog; the words differ, the affordance does not.
 */
export default function ChartNotice({
  message,
  testId,
}: {
  message: ReactNode
  testId?: string
}) {
  return (
    <div
      data-testid={testId ?? 'feature-chart-notice'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#fff9c4',
        color: '#856404',
        border: '1px solid #f9a825',
        fontSize: 12,
        padding: 8,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  )
}
