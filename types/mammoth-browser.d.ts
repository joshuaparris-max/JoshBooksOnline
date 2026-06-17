declare module 'mammoth/mammoth.browser' {
  interface ConvertResult {
    value: string;
    messages: unknown[];
  }
  interface ConvertInput {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    convertToHtml(input: ConvertInput): Promise<ConvertResult>;
    extractRawText(input: ConvertInput): Promise<ConvertResult>;
  };
  export default mammoth;
}
