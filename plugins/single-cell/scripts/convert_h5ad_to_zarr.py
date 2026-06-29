#!/usr/bin/env python3
"""Convert an AnnData .h5ad file to Zarr for the JBrowse single-cell plugin.

Usage:
    python convert_h5ad_to_zarr.py input.h5ad output.zarr/

The script will skip conversion if output.zarr/ already exists unless --force is
passed. It also optionally renames the obs/var index columns so they match the
plugin's default config (obsIndexColumn='index', varIndexColumn='index').
"""

import argparse
import sys
from pathlib import Path

try:
    import anndata as ad
    import scanpy as sc
    from scipy.sparse import issparse
except ImportError as e:
    raise SystemExit(
        "Missing required dependency. Install with:\n"
        "  pip install scanpy anndata zarr scipy"
    ) from e


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a single-cell .h5ad file to Zarr format."
    )
    parser.add_argument("input", help="Input .h5ad file path")
    parser.add_argument("output", help="Output Zarr directory path")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing output directory",
    )
    parser.add_argument(
        "--obs-index-column",
        default="index",
        help="Name to give the obs index column in the output Zarr (default: index)",
    )
    parser.add_argument(
        "--var-index-column",
        default="index",
        help="Name to give the var index column in the output Zarr (default: index)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Chunk size for the X matrix along the obs axis (default: 1000)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if output_path.exists():
        if args.force:
            import shutil

            shutil.rmtree(output_path)
        else:
            print(f"Output already exists, skipping conversion: {output_path}")
            sys.exit(0)

    print(f"Reading {input_path} ...")
    adata = sc.read_h5ad(input_path)

    # Ensure obs/var index columns have predictable names for the plugin config.
    if args.obs_index_column:
        adata.obs[args.obs_index_column] = adata.obs.index
    if args.var_index_column:
        adata.var[args.var_index_column] = adata.var.index

    print(f"Writing Zarr store to {output_path} ...")
    if issparse(adata.X):
        # anndata sparse matrices are already stored in CSR/CSC; write_zarr
        # preserves the format.
        adata.write_zarr(output_path)
    else:
        # Chunk X along the cell axis for efficient column/row reads.
        chunks = (min(args.chunk_size, adata.n_obs), adata.n_vars)
        adata.write_zarr(output_path, chunks=chunks)

    print(f"Done. Use this path in JBrowse: {output_path}")


if __name__ == "__main__":
    main()
