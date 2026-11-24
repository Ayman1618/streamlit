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
  type GridCell,
  GridCellKind,
  type ImageCell,
} from "@glideapps/glide-data-grid"

import { notNullOrUndefined } from "~lib/util/utils"

import {
  createLinkedImageCell,
  getSafeImageLinkHref,
  isLinkedImageCell,
  type LinkedImageCell,
} from "./cells/LinkedImageCell"
import { type BaseColumn, type BaseColumnProps, toSafeString } from "./utils"

interface ImageColumnParams {
  /**
   * The name of the column that contains the URL to open when an image in
   * this column is clicked.
   */
  readonly link_column?: string
}

/**
 * Maps the index number of each image column configured with `link_column`
 * to the column that contains its URLs.
 *
 * Link columns are looked up by name in `allColumns`, which includes hidden
 * columns and columns left out of `column_order`. If several columns share the
 * name, the first one is used. Image columns whose link column does not exist
 * are left out, so their cells render as plain images.
 */
export function getImageLinkColumns(
  columns: BaseColumn[],
  allColumns: BaseColumn[]
): Map<number, BaseColumn> {
  const imageLinkColumns = new Map<number, BaseColumn>()

  columns.forEach(column => {
    if (column.kind !== "image") {
      return
    }

    const linkColumnName = (
      column.columnTypeOptions as ImageColumnParams | undefined
    )?.link_column
    if (typeof linkColumnName !== "string" || linkColumnName === "") {
      return
    }

    const linkColumn = allColumns.find(
      candidate => candidate.name === linkColumnName
    )
    if (linkColumn !== undefined) {
      imageLinkColumns.set(column.indexNumber, linkColumn)
    }
  })

  return imageLinkColumns
}

/**
 * Turns an image cell into a linked image cell if the link value is a usable
 * URL. Cells without an image, with an unusable link value, or of another
 * kind (e.g. error cells) are returned unchanged.
 */
export function withImageLink(cell: GridCell, linkValue: unknown): GridCell {
  if (cell.kind !== GridCellKind.Image || cell.data.length === 0) {
    return cell
  }

  const imageUrl = cell.data[0]
  const href = getSafeImageLinkHref(linkValue)
  if (imageUrl === "" || href === undefined) {
    return cell
  }

  return createLinkedImageCell(cell, href)
}

/**
 * A column type that renders an image as a cell value. On cell selection, open
 * the cell overlay with a full version of the image.
 *
 * If the column is configured with `link_column`, the data loaders turn cells
 * with a usable URL into linked image cells (see `withImageLink`).
 *
 * This column type is currently read-only.
 */
function ImageColumn(props: BaseColumnProps): BaseColumn {
  const cellTemplate: ImageCell = {
    kind: GridCellKind.Image,
    data: [],
    displayData: [],
    readonly: true,
    allowOverlay: true,
    contentAlign: props.contentAlignment ?? "center",
    style: "normal",
  }

  return {
    ...props,
    kind: "image",
    typeIcon: ":material/image:",
    sortMode: "default",
    isEditable: false, // Image columns are always read-only
    getCell(data?: unknown): GridCell {
      // The native image cell implementation in glide-data-grid expects an array
      // of image URLs. For our usecase, we only support single images. We
      // need to wrap the image URL in an array to have it compatible with the
      // implementation in glide-data-grid.
      const imageUrls = notNullOrUndefined(data) ? [toSafeString(data)] : []

      return {
        ...cellTemplate,
        data: imageUrls,
        isMissingValue: !notNullOrUndefined(data),
        displayData: imageUrls,
      } as ImageCell
    },
    getCellValue(cell: ImageCell | LinkedImageCell): string | null {
      if (isLinkedImageCell(cell)) {
        return cell.data.imageUrl
      }

      if (cell.data.length === 0) {
        return null
      }

      // We use the image cell only for single images,
      // so we can safely return just the first element
      return cell.data[0]
    },
  }
}

ImageColumn.isEditableType = false

export default ImageColumn
