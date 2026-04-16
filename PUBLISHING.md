# Releasing/Publishing

## Main release workflow

Run `scripts/release.sh <patch|minor|major>`

This

- creates a git tag
- publishes to npm via the CI jobs on this tag, using trusted publishing
- creates a draft github release. All the desktop release binaries are added to
  the release draft
- publish the release draft when ready. I suggest running 'pnpm releasenotes' to
  get the release notes using gh CLI

## Update embedded demos

This is currently a manual workflow

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Check https://jbrowse.org/demos/lgv shows the new version.
