/**
 * Minimal type shim for `html-to-docx` (ships no types). We use only the default
 * function: HTML → DOCX bytes. In Node it resolves to a Buffer.
 */
declare module 'html-to-docx' {
  interface DocxOptions {
    title?: string
    margins?: { top?: number; right?: number; bottom?: number; left?: number }
    font?: string
    fontSize?: number
    pageNumber?: boolean
    [key: string]: unknown
  }
  export default function htmlToDocx(
    htmlString: string,
    headerHTMLString?: string | null,
    options?: DocxOptions,
    footerHTMLString?: string | null,
  ): Promise<Buffer | ArrayBuffer>
}
