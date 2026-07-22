declare module "xlsx" {
  export type WorkBook = { SheetNames: string[]; Sheets: Record<string, unknown> }
  export function read(data: ArrayBuffer, options?: Record<string, unknown>): WorkBook
  export const utils: {
    sheet_to_json<T>(sheet: unknown, options?: Record<string, unknown>): T[]
  }
}
