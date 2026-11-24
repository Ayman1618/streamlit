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

import type { JSX } from "react"

import {
  type CustomCell,
  GridCellKind,
  type ImageCell,
  imageCellRenderer,
} from "@glideapps/glide-data-grid"
import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"

import renderer, {
  createLinkedImageCell,
  getSafeImageLinkHref,
  isLinkedImageCell,
  type LinkedImageCell,
  LinkedImageCellEditor,
} from "./LinkedImageCell"

const IMAGE_URL = "https://example.com/thumbnail.png"
const HREF = "https://example.com/products/1"

const IMAGE_CELL: ImageCell = {
  kind: GridCellKind.Image,
  data: [IMAGE_URL],
  displayData: [IMAGE_URL],
  allowOverlay: true,
  readonly: true,
  contentAlign: "left",
  style: "normal",
}

type ClickArgs = Parameters<NonNullable<typeof renderer.onClick>>[0]
type SelectArgs = Parameters<NonNullable<typeof renderer.onSelect>>[0]

function makeLinkedCell(href: string): LinkedImageCell {
  return {
    kind: GridCellKind.Custom,
    data: { kind: "linked-image-cell", imageUrl: IMAGE_URL, href },
    allowOverlay: true,
    readonly: true,
    copyData: IMAGE_URL,
  }
}

describe("getSafeImageLinkHref", () => {
  it.each([
    [HREF, HREF],
    ["  https://example.com/a  ", "https://example.com/a"],
    ["/relative/page", "/relative/page"],
    ["www.example.com", "https://www.example.com"],
    ["mailto:team@example.com", "mailto:team@example.com"],
  ])("returns a usable URL for %p", (value, expected) => {
    expect(getSafeImageLinkHref(value)).toBe(expected)
  })

  it.each([
    ["an empty string", ""],
    ["whitespace", "   "],
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a mixed-case javascript: URL", "JavaScript:alert(1)"],
    ["a javascript: URL with a control character", "\x01javascript:alert(1)"],
    ["a vbscript: URL", "vbscript:msgbox(1)"],
  ])("returns undefined for %s", (_description, value) => {
    expect(getSafeImageLinkHref(value)).toBeUndefined()
  })
})

describe("createLinkedImageCell", () => {
  it("keeps the image cell's presentation and uses the image URL for copying and sorting", () => {
    const cell = createLinkedImageCell(IMAGE_CELL, HREF)

    expect(isLinkedImageCell(cell)).toBe(true)
    expect(cell.data).toEqual({
      kind: "linked-image-cell",
      imageUrl: IMAGE_URL,
      href: HREF,
    })
    expect(cell.copyData).toBe(IMAGE_URL)
    expect(cell.contentAlign).toBe("left")
    expect(cell.cursor).toBe("pointer")
    expect(cell).not.toHaveProperty("displayData")
  })
})

describe("LinkedImageCell renderer", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("only matches linked image cells", () => {
    const mediaCell = {
      kind: GridCellKind.Custom,
      data: { kind: "media-cell", mediaType: "audio", src: IMAGE_URL },
      allowOverlay: true,
      copyData: "",
    } as unknown as CustomCell

    expect(renderer.isMatch(makeLinkedCell(HREF))).toBe(true)
    expect(renderer.isMatch(mediaCell)).toBe(false)
    expect(isLinkedImageCell(IMAGE_CELL)).toBe(false)
  })

  it("draws the image with Glide's image renderer", () => {
    const drawSpy = vi
      .spyOn(imageCellRenderer, "draw")
      .mockImplementation(() => undefined)
    const cell = makeLinkedCell(HREF)
    const args = {
      cell,
      col: 1,
      row: 2,
      rect: { x: 0, y: 0, width: 100, height: 34 },
    } as unknown as Parameters<typeof renderer.draw>[0]

    renderer.draw(args, cell)

    expect(drawSpy).toHaveBeenCalledTimes(1)
    const [drawArgs, imageCell] = drawSpy.mock.calls[0]
    expect(imageCell).toMatchObject({
      kind: GridCellKind.Image,
      data: [IMAGE_URL],
    })
    expect(drawArgs.cell).toBe(imageCell)
    expect(drawArgs).toMatchObject({ col: 1, row: 2, rect: args.rect })
  })

  it("opens the link in a new tab with noopener and noreferrer on click", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const preventDefault = vi.fn()

    const result = renderer.onClick?.({
      cell: makeLinkedCell(HREF),
      preventDefault,
    } as unknown as ClickArgs)

    expect(openSpy).toHaveBeenCalledExactlyOnceWith(
      HREF,
      "_blank",
      "noopener,noreferrer"
    )
    // Prevents the click from also opening the image overlay:
    expect(preventDefault).toHaveBeenCalled()
    // The click does not edit the cell:
    expect(result).toBeUndefined()
  })

  it("does not open a dangerous link even if one reaches the cell", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const preventDefault = vi.fn()

    renderer.onClick?.({
      cell: makeLinkedCell("javascript:alert(1)"),
      preventDefault,
    } as unknown as ClickArgs)

    expect(openSpy).not.toHaveBeenCalled()
    expect(preventDefault).toHaveBeenCalled()
  })

  it("prevents mouse selection of the cell", () => {
    const preventDefault = vi.fn()

    renderer.onSelect?.({
      cell: makeLinkedCell(HREF),
      preventDefault,
    } as unknown as SelectArgs)

    expect(preventDefault).toHaveBeenCalled()
  })

  it("provides the linked image overlay for keyboard activation", () => {
    const editor = renderer.provideEditor?.(makeLinkedCell(HREF))

    expect(editor).toEqual({ editor: LinkedImageCellEditor })
  })
})

describe("LinkedImageCellEditor", () => {
  const editor = LinkedImageCellEditor as (props: {
    value: LinkedImageCell
  }) => JSX.Element

  it("links the enlarged image to the destination in a new tab", () => {
    render(editor({ value: makeLinkedCell(HREF) }))

    const link = screen.getByRole("link", { name: HREF })
    expect(link).toHaveAttribute("href", HREF)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    expect(link.querySelector("img")).toHaveAttribute("src", IMAGE_URL)
  })

  it("shows the image without a link for a dangerous destination", () => {
    const { container } = render(
      editor({ value: makeLinkedCell("javascript:alert(1)") })
    )

    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE_URL)
  })
})
