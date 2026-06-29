import { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'

import FeatureRow from './FeatureRow.tsx'
import CreateGeneSetDialog from './CreateGeneSetDialog.tsx'
import AddGeneSetDialog from './AddGeneSetDialog.tsx'
import AddExistingIcon from './AddExistingIcon.tsx'

import type { SingleCellViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.palette.common.white,
    borderLeft: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
  },
  topBar: {
    padding: theme.spacing(0.75, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.common.white,
  },
  search: {
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 1,
    marginTop: theme.spacing(0.5),
    maxHeight: 200,
    overflowY: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.common.white,
  },
  suggestion: {
    padding: theme.spacing(0.5, 1),
    cursor: 'pointer',
    fontSize: 13,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  searchHint: {
    padding: theme.spacing(0.5, 1),
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  geneBlock: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.action.hover,
  },
  expandedHistogram: {
    padding: theme.spacing(1, 1.5, 1.5),
    backgroundColor: theme.palette.common.white,
  },
  emptyState: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
}))

const RightSidebar = observer(function RightSidebar({
  model,
}: {
  model: SingleCellViewModel
}) {
  const { classes } = useStyles()
  const {
    data,
    activeFeatures,
    loadingFeatures,
    expandedFeatures,
    featureValues,
    featureRanges,
    colorBy,
    continuousPalette,
    activeGeneSets,
    loadingGeneSets,
    expandedGeneSets,
    geneSets,
    geneSetValues,
    geneSetRanges,
  } = model
  const [query, setQuery] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement
    name: string
    geneSetName?: string
    type: 'feature' | 'geneSet' | 'geneSetFeature'
  } | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addGeneAnchor, setAddGeneAnchor] = useState<HTMLElement | null>(null)
  const [addGeneSetName, setAddGeneSetName] = useState('')
  const [addGeneQuery, setAddGeneQuery] = useState('')

  if (!data) return null

  const normalizedQuery = query.trim().toLowerCase()
  const normalizedAddGeneQuery = addGeneQuery.trim().toLowerCase()
  const varNameList = data.varNames.map(String)
  const suggestions = normalizedQuery
    ? varNameList
        .filter(name => name.toLowerCase().includes(normalizedQuery))
        .slice(0, 20)
    : []
  const addGeneSuggestions = normalizedAddGeneQuery
    ? varNameList
        .filter(
          name =>
            name.toLowerCase().includes(normalizedAddGeneQuery) &&
            !(geneSets.get(addGeneSetName) ?? ([] as string[])).includes(name),
        )
        .slice(0, 10)
    : []

  const firstName = varNameList[0] ?? ''
  const hasGeneNames =
    varNameList.length > 0 && firstName.length > 0 && !/^\d+$/.test(firstName)

  const handleSelect = (name: string) => {
    void model.setColorByFeature(name)
  }

  const handleEnter = (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase()
    if (!q) return
    const exact = varNameList.find(n => n.toLowerCase() === q)
    if (exact) {
      handleSelect(exact)
      setQuery('')
      return
    }
    const matches = varNameList
      .filter(name => name.toLowerCase().includes(q))
      .slice(0, 20)
    if (matches.length > 0) {
      handleSelect(matches[0]!)
      setQuery('')
    }
  }

  const openMenu = (
    e: React.MouseEvent<HTMLElement>,
    name: string,
    type: 'feature' | 'geneSet' | 'geneSetFeature',
    geneSetName?: string,
  ) => {
    e.stopPropagation()
    setMenuAnchor({ el: e.currentTarget, name, type, geneSetName })
  }

  const closeMenu = () => setMenuAnchor(null)

  return (
    <div
      className={classes.root}
      style={{ width: model.rightSidebarWidth }}
      data-testid="single-cell-right-sidebar"
    >
      <div className={classes.topBar}>
        <Typography variant="subtitle2">Gene expression</Typography>
      </div>

      <div className={classes.search}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search gene..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleEnter(query)
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        {normalizedQuery && !hasGeneNames ? (
          <Typography className={classes.searchHint}>
            Gene names not detected in this dataset.
          </Typography>
        ) : normalizedQuery && suggestions.length === 0 ? (
          <Typography className={classes.searchHint}>
            No matching genes
          </Typography>
        ) : suggestions.length > 0 ? (
          <Box className={classes.suggestions}>
            {suggestions.map(name => (
              <Box
                key={name}
                className={classes.suggestion}
                onClick={() => {
                  handleSelect(name)
                  setQuery('')
                }}
              >
                {name}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography className={classes.searchHint}>
            {hasGeneNames
              ? `${varNameList.length.toLocaleString()} genes available`
              : 'Gene names not detected'}
          </Typography>
        )}
      </div>

      <div className={classes.scrollArea}>
        {activeFeatures.length === 0 ? (
          <Typography className={classes.emptyState}>
            Search for a gene above to visualize its expression.
          </Typography>
        ) : (
          activeFeatures.map(name => (
            <FeatureRow
              key={name}
              model={model}
              name={name}
              values={featureValues.get(name)}
              isLoading={loadingFeatures.includes(name)}
              isExpanded={expandedFeatures.includes(name)}
              isColorBy={colorBy?.kind === 'feature' && colorBy.name === name}
              range={featureRanges.get(name) ?? null}
              palette={continuousPalette}
              transform={
                model.featureTransforms.get(name) ?? {
                  x: 'linear',
                  y: 'linear',
                }
              }
              onToggleExpand={() => model.toggleFeatureExpanded(name)}
              onColorBy={() => void model.setColorByFeature(name)}
              onOpenMenu={e => openMenu(e, name, 'feature')}
              onTransformChange={(axis, transform) =>
                model.setFeatureTransform(name, axis, transform)
              }
              showInfo
            />
          ))
        )}

        <div className={classes.sectionHeader}>
          <Typography variant="subtitle2">Gene sets</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Add existing gene set">
              <IconButton
                size="small"
                onClick={() => setAddDialogOpen(true)}
                sx={{ p: 0.25 }}
              >
                <AddExistingIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Create gene set">
              <IconButton
                size="small"
                onClick={() => setCreateDialogOpen(true)}
                sx={{ p: 0.25 }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </div>
        {activeGeneSets.map(name => {
          const values = geneSetValues.get(name)
          const isLoading = loadingGeneSets.includes(name)
          const isExpanded = expandedGeneSets.includes(name)
          const isColorBy = colorBy?.kind === 'geneSet' && colorBy.name === name
          const genes = geneSets.get(name) ?? []
          return (
            <div key={`set-${name}`} className={classes.geneBlock}>
              <FeatureRow
                model={model}
                name={name}
                values={values}
                isLoading={isLoading}
                isExpanded={isExpanded}
                isColorBy={isColorBy}
                range={geneSetRanges.get(name) ?? null}
                palette={continuousPalette}
                transform={
                  model.geneSetTransforms.get(name) ?? {
                    x: 'linear',
                    y: 'linear',
                  }
                }
                onToggleExpand={() => model.toggleGeneSetExpanded(name)}
                onColorBy={() => void model.setColorByGeneSet(name)}
                onOpenMenu={e => openMenu(e, name, 'geneSet')}
                onAdd={e => {
                  setAddGeneAnchor(e.currentTarget)
                  setAddGeneSetName(name)
                  setAddGeneQuery('')
                }}
                onRangeChange={range => {
                  if (range) {
                    model.setGeneSetRange(name, range.min, range.max)
                  } else {
                    model.clearGeneSetRange(name)
                  }
                }}
                onTransformChange={(axis, transform) =>
                  model.setGeneSetTransform(name, axis, transform)
                }
                histogramLabel={name}
                colorTooltip="Color by this gene set"
                expandedHeader={
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}
                  >
                    {(['mean', 'sum', 'median', 'max'] as const).map(
                      (key, idx, arr) => {
                        const current =
                          model.geneSetAggregatorKeys.get(name) ?? 'mean'
                        const isActive = current === key
                        return (
                          <Button
                            key={key}
                            size="small"
                            onClick={() =>
                              void model.setGeneSetAggregator(name, key)
                            }
                            sx={{
                              minWidth: 0,
                              px: 1,
                              py: 0.25,
                              color: isActive
                                ? 'primary.main'
                                : 'text.secondary',
                              fontWeight: isActive ? 600 : 400,
                              textTransform: 'lowercase',
                              borderRadius: 0,
                              borderRight: idx < arr.length - 1 ? 1 : 0,
                              borderColor: 'divider',
                              lineHeight: 1.2,
                              fontSize: 12,
                            }}
                          >
                            {key}
                          </Button>
                        )
                      },
                    )}
                  </Box>
                }
              />

              {isExpanded && values ? (
                <div className={classes.expandedHistogram}>
                  <Box sx={{ mt: 1 }}>
                    {genes.map(gene => {
                      const expandedKey = `${name}:${gene}`
                      return (
                        <FeatureRow
                          key={`${name}-${gene}`}
                          model={model}
                          name={gene}
                          values={featureValues.get(gene)}
                          isLoading={loadingFeatures.includes(gene)}
                          isExpanded={model.expandedGeneSetFeatures.has(
                            expandedKey,
                          )}
                          isColorBy={
                            colorBy?.kind === 'feature' && colorBy.name === gene
                          }
                          range={featureRanges.get(gene) ?? null}
                          palette={continuousPalette}
                          transform={
                            model.featureTransforms.get(gene) ?? {
                              x: 'linear',
                              y: 'linear',
                            }
                          }
                          onToggleExpand={() =>
                            model.toggleGeneSetFeatureExpanded(name, gene)
                          }
                          onColorBy={() =>
                            void model.setColorByFeature(gene, false)
                          }
                          onOpenMenu={e =>
                            openMenu(e, gene, 'geneSetFeature', name)
                          }
                          onTransformChange={(axis, transform) =>
                            model.setFeatureTransform(gene, axis, transform)
                          }
                          showInfo
                        />
                      )
                    })}
                  </Box>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <Menu
        anchorEl={menuAnchor?.el}
        open={!!menuAnchor}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {menuAnchor ? (
          <>
            <MenuItem
              onClick={() => {
                if (menuAnchor.type === 'feature') {
                  model.removeFeature(menuAnchor.name)
                } else if (menuAnchor.type === 'geneSetFeature') {
                  if (menuAnchor.geneSetName) {
                    model.removeGeneFromGeneSet(
                      menuAnchor.geneSetName,
                      menuAnchor.name,
                    )
                  }
                } else if (menuAnchor.type === 'geneSet') {
                  model.removeGeneSetFromSidebar(menuAnchor.name)
                }
                closeMenu()
              }}
            >
              {menuAnchor.type === 'feature'
                ? 'Remove gene'
                : menuAnchor.type === 'geneSetFeature'
                  ? 'Remove gene from set'
                  : 'Remove from sidebar'}
            </MenuItem>
            {menuAnchor.type === 'feature' ||
            menuAnchor.type === 'geneSetFeature' ? (
              <>
                <Tooltip title="Not implemented yet">
                  <span>
                    <MenuItem disabled>
                      <Typography color="textSecondary">
                        Set gene on X axis
                      </Typography>
                    </MenuItem>
                  </span>
                </Tooltip>
                <Tooltip title="Not implemented yet">
                  <span>
                    <MenuItem disabled>
                      <Typography color="textSecondary">
                        Set gene on Y axis
                      </Typography>
                    </MenuItem>
                  </span>
                </Tooltip>
              </>
            ) : null}
          </>
        ) : null}
      </Menu>

      <Popover
        open={!!addGeneAnchor}
        anchorEl={addGeneAnchor}
        onClose={() => setAddGeneAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1, width: 240 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add gene..."
            value={addGeneQuery}
            onChange={e => setAddGeneQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && addGeneQuery.trim()) {
                const q = addGeneQuery.trim().toLowerCase()
                const target =
                  addGeneSuggestions[0] ??
                  varNameList.find(n => n.toLowerCase() === q)
                if (target && addGeneSetName) {
                  void model.addGeneToGeneSet(addGeneSetName, target)
                  setAddGeneQuery('')
                  setAddGeneAnchor(null)
                }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {addGeneSuggestions.length > 0 && (
            <Box className={classes.suggestions} sx={{ mt: 0.5 }}>
              {addGeneSuggestions.map(name => (
                <Box
                  key={name}
                  className={classes.suggestion}
                  onClick={() => {
                    if (addGeneSetName) {
                      void model.addGeneToGeneSet(addGeneSetName, name)
                      setAddGeneQuery('')
                      setAddGeneAnchor(null)
                    }
                  }}
                >
                  {name}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Popover>

      <CreateGeneSetDialog
        model={model}
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
      <AddGeneSetDialog
        model={model}
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />
    </div>
  )
})

export default RightSidebar
