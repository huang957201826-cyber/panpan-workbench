declare module 'gifenc/dist/gifenc.esm.js' {
  export type GifPalette = number[][]

  export interface GifFrameOptions {
    palette?: GifPalette
    delay?: number
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
  }

  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifFrameOptions): void
    finish(): void
    bytes(): Uint8Array
  }

  export function GIFEncoder(): GifEncoderInstance
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: Record<string, unknown>): GifPalette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: GifPalette, format?: string): Uint8Array
}
