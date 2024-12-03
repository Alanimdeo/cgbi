import { deflate, deflateRaw, inflate, inflateRaw } from "./lib/zlib.js";
import { calculateCRC } from "./lib/crc.js";

type PngHeaderData = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compressMethod: number;
  filterMethod: number;
  interlaceMethod: number;
};

const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CGBI_CHUNK = new Uint8Array([
  0x00, 0x00, 0x00, 0x04, 0x43, 0x67, 0x42, 0x49,
]);

const CGBI_BGRA = new Uint8Array([
  0x50, 0x00, 0x20, 0x06, 0x2c, 0xb8, 0x77, 0x66,
]);

/**
 * Check if the data has a PNG header.
 * @param data - The data to check.
 */
export function hasPngHeader(data: Uint8Array) {
  return isEquals(data.subarray(0, 8), PNG_HEADER);
}

/**
 * Check if the data has a CgBI chunk.
 * @param data - The data to check.
 * @param offset - The offset to start checking. Default is 8(right after the PNG header).
 */
export function hasCgbiChunk(data: Uint8Array, offset: number = 8) {
  return isEquals(data.subarray(offset, offset + 8), CGBI_CHUNK);
}

/**
 * Check if the data is a standard PNG.
 * @param data - The data to check.
 */
export function isStandardPng(data: Uint8Array) {
  return hasPngHeader(data) && !hasCgbiChunk(data);
}

/**
 * Check if the data is a CgBI PNG.
 * @param data - The data to check.
 */
export function isCgbiPng(data: Uint8Array) {
  return hasPngHeader(data) && hasCgbiChunk(data);
}

/**
 * Convert Uint8Array to number.
 * @param data - The data to convert.
 */
function toNumber(data: Uint8Array) {
  let result = 0;
  for (let i = 0; i < data.length; i++) {
    result = result * 256 + data[i];
  }
  return result;
}

/**
 * Convert number to 4-byte Uint8Array.
 * @param data - The data to convert.
 */
function toUint8Array(data: number) {
  const result = new Uint8Array(4);
  for (let i = 3; i >= 0; i--) {
    result[i] = data % 256;
    data = Math.floor(data / 256);
  }
  return result;
}

/**
 * Concatenate multiple Uint8Array.
 * @param arrays - The arrays to concatenate.
 */
function concatUint8Array(...arrays: Uint8Array[]) {
  let length = 0;
  for (const array of arrays) {
    length += array.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

/**
 * Check if two Uint8Array have the same content.
 * @param a - The first array.
 * @param b - The second array.
 */
function isEquals(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Reader class for reading Uint8Array.
 */
class Reader {
  offset: number;

  /**
   * Create a new Reader.
   * @param buffer - The buffer to read.
   * @param offset - The offset to start reading. Default is 0.
   */
  constructor(
    readonly buffer: Uint8Array,
    offset: number = 0
  ) {
    this.offset = offset;
  }

  /**
   * Read a number of bytes from the buffer.
   * @param bytes - The number of bytes to read.
   */
  read(bytes: number): Uint8Array {
    this.offset += bytes;
    return this.buffer.subarray(this.offset - bytes, this.offset);
  }
}

const byteSwapFunctionMap = [
  {
    inflate: inflateRaw,
    deflate: deflate,
  },
  {
    inflate: inflate,
    deflate: deflateRaw,
  },
];

/**
 * Swaps the red and blue bytes in the IDAT chunk.
 * @param idat - The IDAT chunk data.
 * @param width - The width of the image.
 * @param height - The height of the image.
 * @param isCgbi - Whether the image is a CgBI PNG. This is used to determine which zlib function to use. Default is true.
 */
async function byteSwapIdat(
  idat: Uint8Array,
  width: number,
  height: number,
  isCgbi: boolean = true
) {
  const { inflate, deflate } = byteSwapFunctionMap[isCgbi ? 0 : 1];
  const decompressed = await inflate(idat);
  let newIdat = new Uint8Array(decompressed.length);
  let offset = 0;
  for (let i = 0; i < height; i++) {
    newIdat[offset] = decompressed[offset];
    offset++;
    for (let j = 0; j < width; j++) {
      newIdat[offset] = decompressed[offset + 2];
      newIdat[offset + 1] = decompressed[offset + 1];
      newIdat[offset + 2] = decompressed[offset];
      newIdat[offset + 3] = decompressed[offset + 3];
      offset += 4;
    }
  }
  return await deflate(newIdat);
}

/**
 * Convert a CgBI PNG to a standard PNG, or vice versa.
 * @param data - The PNG file data.
 */
export async function convert(data: Uint8Array): Promise<Uint8Array> {
  let isCgbi = false;
  const reader = new Reader(data);

  const result: Uint8Array[] = [PNG_HEADER];

  if (!hasPngHeader(reader.read(8))) {
    throw new Error("Data is not a PNG file.");
  }

  // CgBI chunk
  if (hasCgbiChunk(reader.read(8), 0)) {
    isCgbi = true;
    reader.offset += 8;
  } else {
    reader.offset -= 8;
    result.push(CGBI_CHUNK);
    result.push(CGBI_BGRA);
  }

  // IHDR chunk
  const headerLength = reader.read(4);
  const headerTypeRaw = reader.read(4);
  const headerType = String.fromCharCode(...headerTypeRaw);
  if (headerType !== "IHDR") {
    const headerTypeHex = [];
    for (const byte of headerTypeRaw) {
      headerTypeHex.push(byte.toString(16).padStart(2, "0"));
    }
    throw new Error(`Invalid PNG header: ${headerTypeHex.join(" ")}`);
  }
  const headerData = reader.read(toNumber(headerLength));
  const headerCRC = reader.read(4);

  const header: PngHeaderData = {
    width: toNumber(headerData.subarray(0, 4)),
    height: toNumber(headerData.subarray(4, 8)),
    bitDepth: headerData[8],
    colorType: headerData[9],
    compressMethod: headerData[10],
    filterMethod: headerData[11],
    interlaceMethod: headerData[12],
  };

  result.push(headerLength, headerTypeRaw, headerData, headerCRC);

  // Rest of the chunks
  const idat: Uint8Array[] = [];

  while (reader.offset < data.length) {
    const length = reader.read(4);
    const chunkTypeRaw = reader.read(4);
    const chunkType = String.fromCharCode(...chunkTypeRaw);
    const chunkData = reader.read(toNumber(length));
    const crc = reader.read(4);

    if (chunkType === "IDAT") {
      idat.push(chunkData);
      continue;
    }
    if (chunkType === "iDOT") {
      continue;
    }
    if (chunkType === "IEND") {
      break;
    }

    result.push(length, chunkTypeRaw, chunkData, crc);
  }

  const raw = concatUint8Array(...idat);
  const newIdat = await byteSwapIdat(raw, header.width, header.height, isCgbi);
  const idatCRC = calculateCRC("IDAT", newIdat);
  result.push(
    toUint8Array(newIdat.length),
    new Uint8Array([0x49, 0x44, 0x41, 0x54]), // "IDAT"
    newIdat,
    toUint8Array(idatCRC),
    // prettier-ignore
    new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // length
      0x49, 0x45, 0x4e, 0x44, // "IEND"
      0xae, 0x42, 0x60, 0x82, // CRC
    ])
  );

  return concatUint8Array(...result);
}

export default {
  hasPngHeader,
  hasCgbiChunk,
  isStandardPng,
  isCgbiPng,
  convert,
};
