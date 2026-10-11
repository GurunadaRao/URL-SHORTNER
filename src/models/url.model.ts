import { z } from 'zod';

export interface UrlRecord {
  id: bigint | number;
  shortCode: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt: Date;
  clickCount: number;
  lastAccessedAt: Date | null;
}

export const CreateShortUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .url({ message: 'Must be a valid URL with protocol (e.g. https://example.com)' })
    .max(2048, { message: 'URL exceeds maximum length of 2048 characters' }),
  customAlias: z
    .string()
    .trim()
    .regex(/^[0-9a-zA-Z_-]{3,20}$/, {
      message: 'Custom alias must be 3-20 alphanumeric characters, hyphens, or underscores',
    })
    .optional(),
  retentionYears: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5),
});

export type CreateShortUrlDto = z.infer<typeof CreateShortUrlSchema>;

export interface ShortUrlResponseDto {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string;
  retentionYears: number;
}

export interface UrlAnalyticsDto {
  shortCode: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  clickCount: number;
  lastAccessedAt: string | null;
}
