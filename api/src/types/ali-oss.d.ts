// 阿里云 OSS 类型声明（简化版）
declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint?: string;
    cname?: boolean;
    secure?: boolean;
    timeout?: number;
  }

  interface PutObjectOptions {
    headers?: Record<string, string>;
    meta?: Record<string, string>;
  }

  interface PutObjectResult {
    name: string;
    url: string;
    res: {
      status: number;
      headers: Record<string, string>;
    };
  }

  interface ListObjectsOptions {
    prefix?: string;
    marker?: string;
    'max-keys'?: number;
  }

  interface ListObjectsResult {
    objects: Array<{
      name: string;
      url: string;
      lastModified: string;
      etag: string;
      type: string;
      size: number;
    }>;
    prefixes: string[];
    nextMarker: string | null;
    isTruncated: boolean;
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | string, options?: PutObjectOptions): Promise<PutObjectResult>;
    get(name: string, options?: any): Promise<any>;
    head(name: string, options?: any): Promise<any>;
    delete(name: string): Promise<any>;
    list(options?: ListObjectsOptions): Promise<ListObjectsResult>;
    generateObjectUrl(name: string): string;
    signatureUrl(name: string, options?: { expires?: number; method?: string }): string;
  }

  export = OSS;
}