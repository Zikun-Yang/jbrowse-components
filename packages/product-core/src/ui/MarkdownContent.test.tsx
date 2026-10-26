import { render } from '@testing-library/react'

import MarkdownContent from './MarkdownContent.tsx'

describe('MarkdownContent', () => {
  test('renders the supported markdown subset', () => {
    const { container } = render(
      <MarkdownContent
        markdown={`# Title

Some **bold** and *italic* text with \`inline code\`.

- first
- second

| field | value |
| --- | --- |
| source | GEO |

\`\`\`js
const a = 1
\`\`\`

[link](https://example.com)
`}
      />,
    )

    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
    expect(container.querySelector('li')?.textContent).toBe('first')
    expect(container.querySelector('table')).toBeTruthy()
    expect(container.querySelector('th')?.textContent).toBe('field')
    expect(
      [...container.querySelectorAll('td')].map(td => td.textContent),
    ).toStrictEqual(['source', 'GEO'])
    expect(container.querySelector('pre code')?.textContent).toContain(
      'const a = 1',
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('https://example.com')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('renders gfm extensions', () => {
    const { container } = render(
      <MarkdownContent
        markdown={`~~removed~~

https://example.com/auto

| left | center | right |
| :--- | :----: | ----: |
| a | b | c |
`}
      />,
    )
    expect(container.querySelector('del')?.textContent).toBe('removed')
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.com/auto',
    )
    expect(
      [...container.querySelectorAll('th')].map(th => th.style.textAlign),
    ).toStrictEqual(['left', 'center', 'right'])
  })

  test('raw html never becomes executable markup', () => {
    // @ts-expect-error - test flag
    window.__xss = false
    const { container } = render(
      <MarkdownContent
        markdown={`<img src=x onerror="window.__xss = true">

<script>window.__xss = true</script>

<iframe src="javascript:alert(1)"></iframe>

[click](javascript:window.__xss=true)

[data](data:text/html,<script>alert(1)</script>)
`}
      />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
    // rejected link targets are rendered as plain text, not as anchors
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(container.textContent).toContain('click')
    expect(container.textContent).toContain('data')
    // @ts-expect-error - test flag
    expect(window.__xss).toBe(false)
    expect(container.innerHTML).toMatchSnapshot()
  })

  test('hideUris de-links local paths but keeps remote links', () => {
    const { container } = render(
      <MarkdownContent
        hideUris
        markdown={`[local](./data/track.bam) [remote](https://example.com)

![local image](./data/track.png)
`}
      />,
    )
    const links = [...container.querySelectorAll('a')]
    expect(links).toHaveLength(1)
    expect(links[0]!.getAttribute('href')).toBe('https://example.com')
    expect(container.textContent).toContain('local')
    expect(container.querySelector('img')).toBeNull()
  })

  test('images use the same url whitelist', () => {
    const { container } = render(
      <MarkdownContent markdown={`![ok](https://example.com/a.png)`} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/a.png',
    )

    const { container: rejected } = render(
      <MarkdownContent markdown={`![bad](javascript:alert(1))`} />,
    )
    expect(rejected.querySelector('img')).toBeNull()
  })

  test('renders an empty string without crashing', () => {
    const { container } = render(<MarkdownContent markdown="" />)
    expect(container.textContent).toBe('')
  })
})
