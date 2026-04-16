# Contributing to JBrowse 2

Welcome, we are happy to receive contributions to jbrowse 2. This short guide
will help you get started

## Quick Start

```bash
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
pnpm install
cd products/jbrowse-web
pnpm start
```

## Prerequisites

- **pnpm**: We use [pnpm](https://pnpm.io/) for package management.
- **Windows**: Use `git clone -c core.symlinks=true` to handle symlinks
  correctly (requires admin or Developer Mode).
- **Native Dependencies**: `node-canvas` (used in tests) may require system
  libraries if it can't find prebuilt binaries for your node version:
  - **macOS**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
  - **Ubuntu**:
    `sudo apt install python3 make gcc libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
  - If errors persist, run `pnpm rebuild canvas`.

## Development Commands

Run these from the root directory:

- **Lint**: `pnpm lint` (use `--fix` to auto-fix)
- **Typecheck**: `pnpm typecheck`
- **Format**: `pnpm format`
- **Test**: `pnpm test`

### Running Products

- **JBrowse Web**: `cd products/jbrowse-web && pnpm start`
- **JBrowse Desktop**:
  - Dev Server: `cd products/jbrowse-desktop && pnpm start`
  - Electron App: `cd products/jbrowse-desktop && pnpm electron` (in a second
    terminal)
- **Storybook**:
  `cd products/jbrowse-react-linear-genome-view && pnpm storybook`

## Monorepo Structure

- `packages/`: Core libraries and utilities.
- `plugins/`: Feature-specific code (Alignments, Variants, Wiggle, etc.). Most
  development happens here.
- `products/`: User-facing apps (Web, Desktop, CLI) and embedded components.
- `website/`: Docusaurus documentation and blog.

## Documentation

- **Run Website**: `cd website && pnpm install && pnpm start`
- **Images**: Use a compressor (e.g., `pngquant`). In Markdown, add a caption on
  the line immediately following the image:
  ```markdown
  ![](image.png) Your caption here
  ```
