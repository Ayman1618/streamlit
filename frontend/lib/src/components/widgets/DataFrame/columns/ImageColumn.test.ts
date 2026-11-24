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

import { GridCellKind, type ImageCell } from "@glideapps/glide-data-grid"
import { Field, Utf8 } from "apache-arrow"

import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"

import { isLinkedImageCell } from "./cells/LinkedImageCell"
import ImageColumn, { getImageLinkColumns, withImageLink } from "./ImageColumn"
import TextColumn from "./TextColumn"
import { getErrorCell } from "./utils"

const MOCK_IMAGE_COLUMN_PROPS = {
  id: "1",
  name: "image_column",
  title: "Image column",
  indexNumber: 0,
  isEditable: false,
  isHidden: false,
  isIndex: false,
  isPinned: false,
  isStretched: false,
  arrowType: {
    type: DataFrameCellType.DATA,
    arrowField: new Field("image_column", new Utf8(), true),
    pandasType: {
      field_name: "image_column",
      name: "image_column",
      pandas_type: "unicode",
      numpy_type: "object",
      metadata: null,
    },
  },
}

describe("ImageColumn", () => {
  it("creates a valid column instance", () => {
    const mockColumn = ImageColumn(MOCK_IMAGE_COLUMN_PROPS)
    expect(mockColumn.kind).toEqual("image")
    expect(mockColumn.title).toEqual(MOCK_IMAGE_COLUMN_PROPS.title)
    expect(mockColumn.id).toEqual(MOCK_IMAGE_COLUMN_PROPS.id)
    expect(mockColumn.sortMode).toEqual("default")

    const mockCell = mockColumn.getCell(
      "https://streamlit.io/images/brand/streamlit-logo-primary-colormark-darktext.png"
    )
    expect(mockCell.kind).toEqual(GridCellKind.Image)
    expect(mockCell.contentAlign).toEqual("center")
    expect((mockCell as ImageCell).data).toEqual([
      "https://streamlit.io/images/brand/streamlit-logo-primary-colormark-darktext.png",
    ])
  })

  it("ignores isEditable configuration", () => {
    const mockColumn = ImageColumn({
      ...MOCK_IMAGE_COLUMN_PROPS,
      isEditable: true,
    })

    // Column should be readonly, even if isEditable was true
    expect(mockColumn.isEditable).toEqual(false)
  })

  it.each([
    // Image column supports the
    // same conversions as the text column:
    [
      "https://streamlit.io/images/brand/streamlit-logo-primary-colormark-darktext.png",
      "https://streamlit.io/images/brand/streamlit-logo-primary-colormark-darktext.png",
    ],
    ["/foo", "/foo"],
    ["", ""],
    [[], ""],
    [
      "data:image/png;base64,iVBORw0KGgoAAAAAAAAyCAYAAAAUYybjAAAgAElE...",
      "data:image/png;base64,iVBORw0KGgoAAAAAAAAyCAYAAAAUYybjAAAgAElE...",
    ],
    [null, null],
    [undefined, null],
  ])(
    "supports string-compatible value (%p parsed as %p)",
    (input: unknown, value: string | null) => {
      const mockColumn = ImageColumn(MOCK_IMAGE_COLUMN_PROPS)
      const cell = mockColumn.getCell(input)
      expect(mockColumn.getCellValue(cell)).toEqual(value)
    }
  )

  it("creates native image cells even if link_column is configured", () => {
    const mockColumn = ImageColumn({
      ...MOCK_IMAGE_COLUMN_PROPS,
      columnTypeOptions: { type: "image", link_column: "url" },
    })

    // Links are added by the data loaders, which know the row's link value.
    const cell = mockColumn.getCell("https://example.com/a.png")
    expect(cell.kind).toEqual(GridCellKind.Image)
    expect(cell).not.toHaveProperty("cursor")
  })

  it("returns the image URL as the value of a linked image cell", () => {
    const mockColumn = ImageColumn(MOCK_IMAGE_COLUMN_PROPS)
    const cell = withImageLink(
      mockColumn.getCell("https://example.com/a.png"),
      "https://example.com/details"
    )

    expect(isLinkedImageCell(cell)).toBe(true)
    expect(mockColumn.getCellValue(cell)).toEqual("https://example.com/a.png")
  })
})

describe("getImageLinkColumns", () => {
  const linkedImageColumn = ImageColumn({
    ...MOCK_IMAGE_COLUMN_PROPS,
    columnTypeOptions: { type: "image", link_column: "url" },
  })
  const urlColumn = TextColumn({
    ...MOCK_IMAGE_COLUMN_PROPS,
    id: "2",
    name: "url",
    title: "url",
    indexNumber: 1,
    isHidden: true,
  })

  it("resolves the link column by name, including hidden columns", () => {
    const linkColumns = getImageLinkColumns(
      [linkedImageColumn],
      [linkedImageColumn, urlColumn]
    )

    expect(linkColumns.get(linkedImageColumn.indexNumber)).toBe(urlColumn)
  })

  it("leaves out image columns whose link column does not exist", () => {
    const linkColumns = getImageLinkColumns(
      [linkedImageColumn],
      [linkedImageColumn]
    )

    expect(linkColumns.size).toBe(0)
  })

  it.each([
    ["no link_column", { type: "image" }],
    ["an empty link_column", { type: "image", link_column: "" }],
    ["a non-string link_column", { type: "image", link_column: 1 }],
  ])("ignores image columns with %s", (_description, columnTypeOptions) => {
    const imageColumn = ImageColumn({
      ...MOCK_IMAGE_COLUMN_PROPS,
      columnTypeOptions,
    })

    expect(
      getImageLinkColumns([imageColumn], [imageColumn, urlColumn]).size
    ).toBe(0)
  })

  it("ignores link_column on columns that aren't image columns", () => {
    const textColumn = TextColumn({
      ...MOCK_IMAGE_COLUMN_PROPS,
      columnTypeOptions: { link_column: "url" },
    })

    expect(
      getImageLinkColumns([textColumn], [textColumn, urlColumn]).size
    ).toBe(0)
  })
})

describe("withImageLink", () => {
  const imageColumn = ImageColumn(MOCK_IMAGE_COLUMN_PROPS)
  const imageCell = imageColumn.getCell("https://example.com/a.png")

  it("creates a linked image cell for a usable URL", () => {
    const cell = withImageLink(imageCell, "https://example.com/details")

    expect(isLinkedImageCell(cell)).toBe(true)
    expect(cell).toMatchObject({
      data: {
        imageUrl: "https://example.com/a.png",
        href: "https://example.com/details",
      },
      copyData: "https://example.com/a.png",
    })
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a non-string value", 123],
  ])("keeps the native image cell for %s", (_description, linkValue) => {
    expect(withImageLink(imageCell, linkValue)).toBe(imageCell)
  })

  it.each([
    ["a missing image", imageColumn.getCell(null)],
    ["an empty image URL", imageColumn.getCell("")],
    ["an error cell", getErrorCell("error")],
  ])("keeps %s unchanged", (_description, cell) => {
    expect(withImageLink(cell, "https://example.com/details")).toBe(cell)
  })
})
