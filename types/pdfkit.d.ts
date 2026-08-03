declare module 'pdfkit' {
  export interface PDFKitOptions {
    size?: string | [number, number];
    layout?: 'portrait' | 'landscape';
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    info?: Record<string, unknown>;
    bufferPages?: boolean;
  }

  export default class PDFDocument {
    y: number;
    page: { width: number; height: number };
    currentLineHeight(): number;
    bufferedPageRange(): { count: number };
    switchToPage(pageNumber: number): void;
    on(event: string, listener: (...args: unknown[]) => void): this;
    constructor(options?: PDFKitOptions);
    pipe(stream: NodeJS.WritableStream): void;
    addPage(options?: PDFKitOptions): void;
    end(): void;
    text(text: string, x?: number | Record<string, unknown>, y?: number, options?: Record<string, unknown>): this;
    fontSize(size: number): this;
    font(fontName: string): this;
    moveDown(lines?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    rect(x: number, y: number, width: number, height: number): this;
    fill(color?: string): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    lineWidth(width: number): this;
    image(src: string | Buffer, x: number, y: number, options?: Record<string, unknown>): this;
    registerFont(name: string, src: string): void;
    save(): this;
    restore(): this;
    translate(x: number, y: number): this;
    rotate(angle: number): this;
    scale(x: number, y: number): this;
    opacity(opacity: number): this;
  }
}
