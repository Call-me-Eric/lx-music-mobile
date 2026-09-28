declare function qrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'): {
  addData: (data: string) => void
  make: () => void
  createDataURL: (cellSize?: number, margin?: number) => string
}

export default qrcode
