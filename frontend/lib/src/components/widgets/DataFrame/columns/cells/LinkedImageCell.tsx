/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  type CustomCell,
  type CustomRenderer,
  type GridCell,
  GridCellKind,
  type ImageCell,
  imageCellRenderer,
  type ProvideEditorCallback,
} from "@glideapps/glide-data-grid"

import { isDangerousLinkUri } from "~lib/util/UriUtil"

import { StyledImage } from "./ImageCellEditor"

interface LinkedImageCellProps {
  readonly kind: "linked-image-cell"
  /** The image URL or data URI shown in the cell. */
  readonly imageUrl: string
  /** The destination opened when the image is clicked. */
  readonly href: string
}

/**
 * An image cell of an `ImageColumn` configured with `link_column`. It is only
 * created when the row has a usable destination; all other image cells stay
 * native Glide image cells.
 */
export type LinkedImageCell = CustomCell<LinkedImageCellProps>

export function isLinkedImageCell(cell: GridCell): cell is LinkedImageCell {
  return (
    cell.kind === GridCellKind.Custom &&
    (cell.data as { kind?: string } | null | undefined)?.kind ===
      "linked-image-cell"
  )
}

/**
 * Returns the URL to open for a link column value, or `undefined` if the value
 * must not become a link: non-strings, empty strings, and dangerous schemes
 * such as `javascript:`. As in `LinkColumn`, values starting with `www.` are
 * opened as `https://` URLs.
 */
export function getSafeImageLinkHref(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const href = value.trim()
  if (href === "" || isDangerousLinkUri(href)) {
    return undefined
  }

  return href.startsWith("www.") ? `https://${href}` : href
}

/**
 * Opens the link in a new tab without giving the new page access to the app
 * window (`noopener`) or the app URL (`noreferrer`).
 */
function openImageLink(href: string): void {
  const safeHref = getSafeImageLinkHref(href)
  if (safeHref !== undefined) {
    window.open(safeHref, "_blank", "noopener,noreferrer")
  }
}

/**
 * Creates a linked image cell from a native image cell, keeping its styling
 * and alignment. `copyData` holds the image URL so that copying and sorting
 * behave like a native image cell.
 */
export function createLinkedImageCell(
  imageCell: ImageCell,
  href: string
): LinkedImageCell {
  const imageUrl = imageCell.data[0]
  const { data: _data, displayData: _displayData, ...cellProps } = imageCell

  return {
    ...cellProps,
    kind: GridCellKind.Custom,
    data: { kind: "linked-image-cell", imageUrl, href },
    copyData: imageUrl,
    cursor: "pointer",
  }
}

function toImageCell(cell: LinkedImageCell): ImageCell {
  return {
    kind: GridCellKind.Image,
    data: [cell.data.imageUrl],
    displayData: [cell.data.imageUrl],
    allowOverlay: cell.allowOverlay,
    readonly: true,
    contentAlign: cell.contentAlign,
  }
}

/**
 * The overlay shown when the cell is activated with the keyboard (Enter).
 * The enlarged image links to the cell's destination.
 */
export const LinkedImageCellEditor: ReturnType<
  ProvideEditorCallback<LinkedImageCell>
> = ({ value }) => {
  const { imageUrl, href } = value.data
  const safeHref = getSafeImageLinkHref(href)

  if (safeHref === undefined) {
    return <StyledImage src={imageUrl} />
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={safeHref}
    >
      <StyledImage src={imageUrl} alt="" />
    </a>
  )
}

/**
 * Renders the image with Glide's image renderer and opens the destination on
 * click. A click on the image opens the link instead of selecting the cell or
 * opening the overlay, so the overlay is reached with the keyboard.
 */
const renderer: CustomRenderer<LinkedImageCell> = {
  kind: GridCellKind.Custom,
  isMatch: (cell): cell is LinkedImageCell => isLinkedImageCell(cell),
  draw: (args, cell) => {
    const imageCell = toImageCell(cell)
    imageCellRenderer.draw({ ...args, cell: imageCell }, imageCell)
    return true
  },
  measure: (ctx, cell, theme) =>
    imageCellRenderer.measure?.(ctx, toImageCell(cell), theme) ?? 0,
  onSelect: args => args.preventDefault(),
  onClick: args => {
    openImageLink(args.cell.data.href)
    // Prevent the click from also activating the cell overlay:
    args.preventDefault()
    return undefined
  },
  provideEditor: () => ({
    editor: LinkedImageCellEditor,
  }),
}

export default renderer
