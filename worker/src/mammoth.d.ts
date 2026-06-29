declare module 'mammoth' {
  export const images: {
    imgElement: (
      converter: (image: { read: (format: 'base64') => Promise<string>; contentType: string }) => Promise<{ src: string; alt?: string }>,
    ) => unknown;
  };

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: { convertImage?: unknown },
  ): Promise<{ value: string; messages: unknown[] }>;
}
