# cgbi

[![view on npm](https://badgen.net/npm/v/cgbi)](https://www.npmjs.org/package/cgbi)

Converts PNG images from/to Apple's CgBI format.

## Installation

You can install the package using npm:

```sh
npm install cgbi
```

If you want to use the package in a browser, you can include it using a CDN:

```html
<script type="module">
  import cgbi from "https://cdn.jsdelivr.net/npm/cgbi/+esm";
</script>
```

## Usage

Convert a standard PNG image to CgBI format(or vice versa):

```js
import fs from "fs";
import { convert } from "cgbi";

const pngFile = fs.readFileSync("image.png");

const converted = convert(pngFile);
fs.writeFileSync("converted.png", converted);
```

## Functions

### `convert(data: Uint8Array): Uint8Array`

Converts a PNG image from/to CgBI format.

If `data` is a standard PNG image, it will be converted to CgBI format. If `data` is a CgBI image, it will be converted to standard PNG format.

### `isCgbiPng(data: Uint8Array): boolean`

Returns `true` if `data` is a CgBI PNG image, `false` otherwise.

### `isStandardPng(data: Uint8Array): boolean`

Returns `true` if `data` is a standard PNG image, `false` otherwise.

### `hasPngHeader(data: Uint8Array): boolean`

Returns `true` if `data` starts with a PNG header(`89 50 4e 47 0d 0a 1a 0a`), `false` otherwise.

### `hasCgbiChunk(data: Uint8Array, offset: number = 8): boolean`

Returns `true` if `data` has a CgBI chunk at the specified `offset`, `false` otherwise.

Default `offset` is `8`(right after the PNG header).

## License

MIT
