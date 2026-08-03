declare module 'json2csv' {
  export interface ParserOptions {
    fields?: string[];
    delimiter?: string;
    quote?: string;
    eol?: string;
    header?: boolean;
    withBOM?: boolean;
    flatten?: boolean;
    unwind?: string | string[];
    includeEmptyRows?: boolean;
    excelStrings?: boolean;
  }

  export class Parser<T = Record<string, unknown>> {
    constructor(options?: ParserOptions);
    parse(data: T[]): string;
  }
}
