# Migrating from Supabase Storage to Cloudflare R2

This guide explains how to migrate file storage from Supabase Storage to Cloudflare R2.

## Why Cloudflare R2?

**Benefits:**
- **Zero egress fees** - No charges for bandwidth (vs. AWS S3's high egress costs)
- **S3-compatible API** - Drop-in replacement with minimal code changes
- **Global edge network** - Fast delivery worldwide via Cloudflare's CDN
- **Generous free tier** - 10 GB storage, 1M Class A operations, 10M Class B operations per month
- **Simple pricing** - $0.015/GB storage after free tier

**Alternatives considered:**
- AWS S3: High egress fees make it expensive for video delivery
- Vercel Blob: Good but vendor lock-in and higher costs at scale
- Uploadthing: Great DX but limited to file uploads, not general storage

## R2 Setup

### 1. Create R2 Bucket

```bash
# Login to Cloudflare (if not already)
npx wrangler login

# Create production bucket
npx wrangler r2 bucket create velro-production

# Create development bucket (optional but recommended)
npx wrangler r2 bucket create velro-development
```

**Via Dashboard (alternative):**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 → Create bucket
3. Name: `velro-production`
4. Location: Auto (or choose specific region)
5. Click "Create bucket"

### 2. Create API Token

**Via Dashboard:**
1. Go to R2 → Manage R2 API Tokens
2. Click "Create API Token"
3. Name: `velro-api-token`
4. Permissions:
   - **Object Read & Write** (for uploading/downloading files)
   - Scope: Select your bucket(s)
5. Click "Create API Token"
6. **Save these credentials** (shown once):
   - Access Key ID
   - Secret Access Key
   - Endpoint (jurisdiction-specific URL)

**Via CLI (alternative):**
```bash
npx wrangler r2 token create velro-api-token --jurisdiction auto
```

### 3. Get Bucket Configuration

You'll need:
- **Account ID**: Found in Cloudflare dashboard URL (`dash.cloudflare.com/<account-id>/`)
- **Jurisdiction endpoint**: Auto-selected or from token creation
- **Bucket name**: `velro-production`
- **Public URL** (optional): Configure R2 custom domain for public access

## Environment Variables

Add to your `.env.local` / `.env.production`:

```bash
# R2 Storage Configuration
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=velro-production
R2_JURISDICTION=auto  # or specific: eu, us

# Optional: Custom domain for public URLs
# Set up via Cloudflare Dashboard: R2 → Bucket → Settings → Public Access
R2_PUBLIC_URL=https://cdn.velro.ai  # Or R2.dev subdomain
```

**Development environment:**
```bash
# .env.development.local
R2_BUCKET_NAME=velro-development
# ... same credentials or separate dev credentials
```

## Code Changes

### 1. Install Dependencies

```bash
# Remove Supabase packages (after migration complete)
bun remove @supabase/supabase-js @supabase/ssr

# Add AWS SDK for S3-compatible storage
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Update Storage Helper

Replace `src/lib/db/helpers/storage.ts`:

```typescript
/**
 * Storage Helpers
 * Utilities for working with Cloudflare R2 (S3-compatible storage)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Storage bucket prefixes
 * R2 uses a flat namespace, so we use prefixes to organize files
 */
export const STORAGE_BUCKETS = {
  THUMBNAILS: 'thumbnails',
  VIDEOS: 'videos',
  AUDIO: 'audio',
  STYLES: 'styles',
  CHARACTERS: 'characters',
  VFX: 'vfx',
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Upload result with URL and path information
 */
export type UploadResult = {
  path: string;
  publicUrl: string;
  fullPath: string;
};

/**
 * R2 Configuration
 */
const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucketName: process.env.R2_BUCKET_NAME!,
  jurisdiction: process.env.R2_JURISDICTION || 'auto',
  publicUrl: process.env.R2_PUBLIC_URL || '', // Empty if using signed URLs
};

// Validate required environment variables
if (!R2_CONFIG.accountId) {
  throw new Error('R2_ACCOUNT_ID environment variable is required');
}
if (!R2_CONFIG.accessKeyId) {
  throw new Error('R2_ACCESS_KEY_ID environment variable is required');
}
if (!R2_CONFIG.secretAccessKey) {
  throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
}
if (!R2_CONFIG.bucketName) {
  throw new Error('R2_BUCKET_NAME environment variable is required');
}

/**
 * Create R2 client (S3-compatible)
 */
function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto', // R2 uses 'auto' for region
    endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_CONFIG.accessKeyId,
      secretAccessKey: R2_CONFIG.secretAccessKey,
    },
  });
}

// Singleton client instance
let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!client) {
    client = createR2Client();
  }
  return client;
}

/**
 * Build full key with bucket prefix
 * R2 uses flat namespace, so prefix acts like bucket folder
 */
function buildKey(bucket: StorageBucket, path: string): string {
  return `${bucket}/${path}`;
}

/**
 * Upload a file to R2
 *
 * @param bucket - The storage bucket prefix
 * @param path - The file path within the bucket (e.g., 'team-id/sequence-id/frame-id.jpg')
 * @param file - The file to upload (File, Blob, or Buffer)
 * @param options - Optional upload options (upsert, content type, etc.)
 * @returns Upload result with path and public URL
 * @throws Error if upload fails
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File | Blob | Buffer,
  options?: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
  }
): Promise<UploadResult> {
  const client = getR2Client();
  const key = buildKey(bucket, path);

  // Convert File/Blob to Buffer if needed
  let body: Buffer;
  if (file instanceof Buffer) {
    body = file;
  } else if (file instanceof Blob) {
    body = Buffer.from(await file.arrayBuffer());
  } else {
    body = Buffer.from(await (file as File).arrayBuffer());
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: body,
        ContentType: options?.contentType || 'application/octet-stream',
        CacheControl: options?.cacheControl || 'public, max-age=31536000', // 1 year
        // Note: R2 doesn't have "upsert" concept - PUT always overwrites
      })
    );

    const publicUrl = getPublicUrl(bucket, path);

    return {
      path,
      publicUrl,
      fullPath: key,
    };
  } catch (error) {
    throw new Error(
      `Failed to upload file to ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the public URL for a file
 * Uses custom domain if configured, otherwise returns signed URL
 *
 * @param bucket - The storage bucket prefix
 * @param path - The file path within the bucket
 * @returns Public URL for the file
 */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const key = buildKey(bucket, path);

  // If public URL is configured (custom domain), use it
  if (R2_CONFIG.publicUrl) {
    return `${R2_CONFIG.publicUrl}/${key}`;
  }

  // Otherwise, return R2.dev URL (requires Public Access enabled on bucket)
  return `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Get a signed URL for temporary access
 * Use this for private files or temporary access
 *
 * @param bucket - The storage bucket prefix
 * @param path - The file path within the bucket
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL for the file
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const client = getR2Client();
  const key = buildKey(bucket, path);

  try {
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    return signedUrl;
  } catch (error) {
    throw new Error(
      `Failed to create signed URL for ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a file from storage
 *
 * @param bucket - The storage bucket prefix
 * @param path - The file path within the bucket
 * @throws Error if deletion fails
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const client = getR2Client();
  const key = buildKey(bucket, path);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
      })
    );
  } catch (error) {
    throw new Error(
      `Failed to delete file from ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete multiple files from storage
 *
 * @param bucket - The storage bucket prefix
 * @param paths - Array of file paths to delete
 * @throws Error if deletion fails
 */
export async function deleteFiles(
  bucket: StorageBucket,
  paths: string[]
): Promise<void> {
  const client = getR2Client();

  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: R2_CONFIG.bucketName,
        Delete: {
          Objects: paths.map((path) => ({ Key: buildKey(bucket, path) })),
        },
      })
    );
  } catch (error) {
    throw new Error(
      `Failed to delete files from ${bucket}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * List files in a directory
 *
 * @param bucket - The storage bucket prefix
 * @param path - The directory path to list (empty string for root)
 * @param options - Optional listing options
 * @returns Array of file objects with metadata
 */
export async function listFiles(
  bucket: StorageBucket,
  path = '',
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  const client = getR2Client();
  const prefix = path ? buildKey(bucket, path) : bucket;

  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_CONFIG.bucketName,
      Prefix: prefix,
      MaxKeys: options?.limit || 1000,
      // Note: R2 doesn't support offset, use ContinuationToken for pagination
    });

    const response = await client.send(command);

    return (response.Contents || []).map((item) => ({
      name: item.Key?.replace(`${bucket}/`, '') || '',
      id: item.Key || '',
      metadata: {
        size: item.Size || 0,
        lastModified: item.LastModified,
        eTag: item.ETag,
      },
    }));
  } catch (error) {
    throw new Error(
      `Failed to list files in ${bucket}/${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Move or rename a file
 * Implemented as copy + delete
 *
 * @param bucket - The storage bucket prefix
 * @param fromPath - Current file path
 * @param toPath - New file path
 */
export async function moveFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const client = getR2Client();
  const fromKey = buildKey(bucket, fromPath);
  const toKey = buildKey(bucket, toPath);

  try {
    // Copy to new location
    await client.send(
      new CopyObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        CopySource: `${R2_CONFIG.bucketName}/${fromKey}`,
        Key: toKey,
      })
    );

    // Delete original
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fromKey,
      })
    );
  } catch (error) {
    throw new Error(
      `Failed to move file from ${fromPath} to ${toPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Copy a file
 *
 * @param bucket - The storage bucket prefix
 * @param fromPath - Source file path
 * @param toPath - Destination file path
 */
export async function copyFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string
): Promise<void> {
  const client = getR2Client();
  const fromKey = buildKey(bucket, fromPath);
  const toKey = buildKey(bucket, toPath);

  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        CopySource: `${R2_CONFIG.bucketName}/${fromKey}`,
        Key: toKey,
      })
    );
  } catch (error) {
    throw new Error(
      `Failed to copy file from ${fromPath} to ${toPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a file exists in storage
 *
 * @param bucket - The storage bucket prefix
 * @param path - The file path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExists(
  bucket: StorageBucket,
  path: string
): Promise<boolean> {
  const client = getR2Client();
  const key = buildKey(bucket, path);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}
```

### 3. Update Service Files

**`src/lib/services/video-storage.service.ts`:**

No changes needed if it imports from `@/lib/db/helpers/storage` - the abstraction handles everything!

**`src/lib/image/image-storage.ts`:**

Same - if it uses the storage helper functions, it just works.

## Public Access Configuration

### Option 1: Custom Domain (Recommended for Production)

1. Go to R2 Dashboard → Your Bucket → Settings
2. Click "Connect Domain"
3. Enter your subdomain: `cdn.velro.ai`
4. Add DNS record as instructed (CNAME or R2-specific record)
5. Set `R2_PUBLIC_URL=https://cdn.velro.ai` in environment

**Benefits:**
- Custom branding
- Better SEO
- Potential for additional CDN features

### Option 2: R2.dev Subdomain (Quick Setup)

1. Go to R2 Dashboard → Your Bucket → Settings
2. Enable "Public Access"
3. Get auto-generated URL: `https://<bucket>.<account-id>.r2.cloudflarestorage.com`
4. Set as `R2_PUBLIC_URL` or leave empty (code will auto-generate)

**Trade-offs:**
- No custom domain
- Still fast via Cloudflare edge
- Good for development/testing

### Option 3: Signed URLs (Private Buckets)

Don't enable public access - use `getSignedUrl()` for all file access.

**Best for:**
- Private content
- User-specific files
- Temporary access

## Testing the Migration

### 1. Unit Tests

Update storage helper tests (if any):

```typescript
// __tests__/storage.test.ts
import { describe, it, expect, mock } from 'bun:test';
import { uploadFile, getPublicUrl, deleteFile } from '@/lib/db/helpers/storage';

mock.module('@aws-sdk/client-s3', () => ({
  S3Client: mock(() => ({
    send: mock(() => Promise.resolve({})),
  })),
  PutObjectCommand: mock(),
  GetObjectCommand: mock(),
  DeleteObjectCommand: mock(),
}));

describe('R2 Storage', () => {
  it('should upload a file', async () => {
    const result = await uploadFile(
      'thumbnails',
      'test/image.jpg',
      Buffer.from('test'),
      { contentType: 'image/jpeg' }
    );

    expect(result.path).toBe('test/image.jpg');
    expect(result.publicUrl).toContain('thumbnails/test/image.jpg');
  });

  it('should generate public URLs correctly', () => {
    const url = getPublicUrl('videos', 'team-123/video.mp4');
    expect(url).toContain('videos/team-123/video.mp4');
  });
});
```

### 2. Integration Tests

Test with real R2 bucket:

```bash
# Create test script
cat > scripts/test-r2-storage.ts << 'EOF'
import {
  uploadFile,
  getPublicUrl,
  deleteFile,
  fileExists,
} from '@/lib/db/helpers/storage';

async function testR2Storage() {
  console.log('🧪 Testing R2 storage...\n');

  const testFile = Buffer.from('Hello R2!');
  const testPath = `test-${Date.now()}.txt`;

  try {
    // Test upload
    console.log('📤 Uploading test file...');
    const uploadResult = await uploadFile('thumbnails', testPath, testFile, {
      contentType: 'text/plain',
    });
    console.log('✅ Upload successful');
    console.log('   Path:', uploadResult.path);
    console.log('   Public URL:', uploadResult.publicUrl);

    // Test existence check
    console.log('\n🔍 Checking if file exists...');
    const exists = await fileExists('thumbnails', testPath);
    console.log(exists ? '✅ File exists' : '❌ File not found');

    // Test deletion
    console.log('\n🗑️  Deleting test file...');
    await deleteFile('thumbnails', testPath);
    console.log('✅ Deletion successful');

    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const stillExists = await fileExists('thumbnails', testPath);
    console.log(stillExists ? '❌ File still exists!' : '✅ File deleted');

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testR2Storage();
EOF

# Run test
bun run scripts/test-r2-storage.ts
```

### 3. Manual Testing Checklist

- [ ] Upload image to thumbnails bucket
- [ ] Access uploaded image via public URL
- [ ] Upload video to videos bucket
- [ ] Generate signed URL for private access
- [ ] Delete file and verify removal
- [ ] Test file listing in a directory
- [ ] Test moving/copying files
- [ ] Verify cache headers are correct
- [ ] Test from production environment

## Deployment Checklist

### Pre-deployment

- [ ] R2 bucket created and configured
- [ ] API tokens generated and saved
- [ ] Environment variables set in production
- [ ] Custom domain configured (if using)
- [ ] Public access settings verified
- [ ] Code changes tested locally
- [ ] Integration tests passing

### Deployment

1. **Deploy code changes**
   ```bash
   git add .
   git commit -m "Migrate storage from Supabase to R2"
   git push origin main
   ```

2. **Set environment variables in Vercel/your platform**
   ```bash
   vercel env add R2_ACCOUNT_ID production
   vercel env add R2_ACCESS_KEY_ID production
   vercel env add R2_SECRET_ACCESS_KEY production
   vercel env add R2_BUCKET_NAME production
   vercel env add R2_PUBLIC_URL production
   ```

3. **Trigger deployment**
   ```bash
   vercel --prod
   ```

### Post-deployment

- [ ] Test file uploads in production
- [ ] Verify public URLs are accessible
- [ ] Check CloudWatch/logs for errors
- [ ] Monitor R2 dashboard for usage
- [ ] Test all upload flows (thumbnails, videos, styles, etc.)

## Migration Strategy for Existing Files

**Note:** You mentioned you don't care about existing data, but here's the strategy if needed:

### Option 1: Background Migration (No Downtime)

1. Deploy new code with R2 support
2. Keep Supabase Storage URLs working (old files)
3. New uploads go to R2
4. Run background job to copy files from Supabase to R2
5. Update database URLs to point to R2
6. Verify everything works
7. Delete files from Supabase

### Option 2: Fresh Start (Your Case)

1. Deploy with R2 support
2. All new uploads go to R2
3. Old Supabase URLs become stale (acceptable per your requirements)
4. Eventually remove Supabase Storage entirely

## Cost Estimation

**R2 Pricing:**
- Storage: Free for first 10 GB, then $0.015/GB/month
- Class A operations (PUT, POST): $4.50 per million (after 1M free)
- Class B operations (GET, HEAD): $0.36 per million (after 10M free)
- Egress: **FREE** (this is the big win!)

**Example monthly costs for 100 GB storage:**
- Storage: 100 GB × $0.015 = $1.50/month
- Operations: Within free tier for most apps
- Egress: $0 (vs. AWS S3: ~$9/GB = $900 for 100 GB egress)

## Troubleshooting

### "Access Denied" Errors

**Problem:** Cannot upload/read files

**Solution:**
- Verify API token has correct permissions
- Check token hasn't expired
- Ensure `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are correct
- Verify bucket name matches exactly

### "Public URL Returns 404"

**Problem:** Files upload successfully but URLs return 404

**Solutions:**
1. Enable Public Access on bucket (R2 Dashboard → Settings)
2. Configure custom domain properly
3. Or use signed URLs for private buckets

### "SignatureDoesNotMatch" Error

**Problem:** S3 client signature mismatch

**Solution:**
- Verify endpoint format: `https://<account-id>.r2.cloudflarestorage.com`
- Check region is set to `'auto'`
- Ensure credentials don't have extra whitespace

### Slow Upload Performance

**Problem:** Uploads taking too long

**Solutions:**
1. Use Cloudflare Workers for edge uploads (advanced)
2. Implement multipart upload for large files
3. Compress files before uploading
4. Consider Worker-based upload proxy closer to users

## Next Steps

After R2 migration:
1. Monitor usage in R2 dashboard
2. Set up alerting for storage quota
3. Implement CDN caching strategies
4. Consider Workers for advanced transformations (image resizing, etc.)
5. Remove Supabase Storage dependencies

## Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 vs S3 Comparison](https://developers.cloudflare.com/r2/reference/comparison/)
