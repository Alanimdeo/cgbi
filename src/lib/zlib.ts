import pako from "pako";

function promisify<T>(fn: (buf: Uint8Array) => T) {
  return (buf: Uint8Array) => {
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(fn(buf));
      } catch (err) {
        reject(err);
      }
    });
  };
}

export const deflate = promisify(pako.deflate);
export const deflateRaw = promisify(pako.deflateRaw);
export const inflate = promisify(pako.inflate);
export const inflateRaw = promisify(pako.inflateRaw);
