# Supabase Storage to Cloudflare R2 Migration Plan

## Overview

Migrate from Supabase Storage to Cloudflare R2 for all file storage operations (thumbnails, videos, audio, styles, characters, vfx). This migration will reduce costs and improve performance with Cloudflare's global CDN.

## Goals

- Migrate all existing files from Supabase Storage to R2
- Update all storage operations to use R2 going forward
- Maintain file access for authenticated users via signed URLs
- Use Cloudflare CDN for optimized delivery
- Support local development, preview, and production environments

## R2 Bucket Structure

### Option A: Single Bucket with Prefixes (Recommended)

- **Production**: `velro-storage`
  - `thumbnails/teams/{teamId}/...`
  - `videos/teams/{teamId}/...`
  - `audio/teams/{teamId}/...`
  - `styles/teams/{teamId}/...`
  - `characters/teams/{teamId}/...`
  - `vfx/teams/{teamId}/...`

- **Development/Preview**: `velro-storage-dev`
  - Same structure as production

### Option B: Separate Buckets per Environment

- `velro-thumbnails-prod`, `velro-videos-prod`, etc.
- `velro-thumbnails-dev`, `velro-videos-dev`, etc.

**Recommendation**: Use Option A (single bucket with prefixes) for simplicity and cost efficiency.

## R2 Setup Steps

### 1. Create Cloudflare R2 Buckets

```bash
# In Cloudflare Dashboard:
# 1. Navigate to R2 Object Storage
# 2. Create bucket: velro-storage (production)
# 3. Create bucket: velro-storage-dev (development/preview)
```

### 2. Create API Tokens

```bash
# In Cloudflare Dashboard:
# 1. Navigate to R2 > Manage R2 API Tokens
# 2. Create API Token with:
#    - Permissions: Object Read & Write
#    - Buckets: velro-storage, velro-storage-dev
# 3. Save: Access Key ID, Secret Access Key, Account ID
```

### 3. Configure Custom Domain for CDN (Optional)

```bash
# In Cloudflare Dashboard:
# 1. R2 bucket settings > Public Access
# 2. Connect custom domain (e.g., cdn.velro.ai)
# 3. Configure CORS if needed
```

## Technical Implementation

### 1. Install Dependencies

```bash
bun add @aws-sdk/client-s3
bun add @aws-sdk/s3-request-presigner
```

### 2. Environment Variables

Add to `.env.development.local` and production environment:

```bash
# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=velro-storage-dev  # or velro-storage for prod
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # R2 public URL
```

### 3. Create R2 Storage Service

**File**: `src/lib/storage/r2-client.ts`

```typescript
import { S3Client } from '@aws-sdk/client-s3';

export function createR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
```

### 4. Update Storage Helpers

**File**: `src/lib/db/helpers/storage.ts`

- Replace Supabase storage client with R2 S3 client
- Implement S3 operations: `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`
- Generate presigned URLs using `@aws-sdk/s3-request-presigner`
- Maintain same API interface for backward compatibility

### 5. Update Image Storage Service

**File**: `src/lib/image/image-storage.ts`

- Update `uploadImageToStorage()` to use R2
- Update `getSignedImageUrl()` to generate R2 presigned URLs
- Update `deleteImageFromStorage()` to use R2
- Maintain same function signatures

### 6. Update Video Storage Service

**File**: `src/lib/services/video-storage.service.ts`

- Update `uploadVideoToStorage()` to use R2
- Update `getSignedVideoUrl()` to generate R2 presigned URLs
- Update `deleteVideoFromStorage()` to use R2
- Maintain same function signatures

## Migration Strategy

### Phase 1: Implementation (Week 1)

1. Create R2 buckets and configure API tokens
2. Implement R2 storage service layer
3. Update storage helpers to use R2
4. Update image and video storage services
5. Update workflows to use new storage
6. Add environment variables to all environments

### Phase 2: Testing (Week 1)

1. Test file uploads in local development
2. Test file retrieval via presigned URLs
3. Test file deletion
4. Test workflows end-to-end
5. Verify CORS configuration
6. Test in preview environment (PR branch)

### Phase 3: Data Migration (Week 2)

1. Create migration script to copy all files from Supabase to R2
2. Run migration script against production data
3. Verify all files transferred successfully
4. Update database records with new R2 URLs (if needed)

### Phase 4: Production Deployment (Week 2)

1. Deploy R2 storage changes to production
2. Monitor for errors
3. Verify new uploads work correctly
4. Keep Supabase Storage as backup for 30 days
5. After 30 days, delete Supabase Storage buckets

## Migration Script

**File**: `scripts/migrate-supabase-to-r2.ts`

```typescript
/**
 * Migration script to copy files from Supabase Storage to R2
 *
 * Usage:
 *   bun scripts/migrate-supabase-to-r2.ts --bucket thumbnails
 *   bun scripts/migrate-supabase-to-r2.ts --bucket videos
 *   bun scripts/migrate-supabase-to-r2.ts --all
 */

// Process:
// 1. List all files in Supabase bucket
// 2. For each file:
//    a. Download from Supabase
//    b. Upload to R2
//    c. Verify upload
//    d. Log progress
// 3. Generate migration report
```

## Testing Checklist

- [ ] Local development: Upload thumbnail image
- [ ] Local development: Upload video
- [ ] Local development: Display image in browser
- [ ] Local development: Play video in browser
- [ ] Local development: Delete file
- [ ] Preview environment: Upload and display files
- [ ] Preview environment: Workflows complete successfully
- [ ] Production: Run migration script for thumbnails
- [ ] Production: Run migration script for videos
- [ ] Production: Verify all files accessible
- [ ] Production: New uploads work correctly
- [ ] Production: Monitor error logs for 48 hours

## Rollback Plan

Since there's no dual-write strategy, rollback requires:

1. Revert code deployment
2. Files uploaded to R2 during deployment will need to be re-uploaded to Supabase
3. Keep Supabase Storage active for 30 days as safety net

**Note**: Database records store URLs, so changing storage provider requires URL updates or regeneration.

## Cost Comparison

### Supabase Storage

- $0.021/GB storage per month
- Egress costs vary

### Cloudflare R2

- $0.015/GB storage per month
- **Zero egress fees**
- Class A operations: $4.50 per million
- Class B operations: $0.36 per million

**Expected Savings**: ~30% on storage + 100% on egress

## Security Considerations

1. **Private Buckets**: All buckets remain private
2. **Presigned URLs**: Generate time-limited signed URLs (default: 1 hour)
3. **Authentication**: Verify user authentication before generating signed URLs
4. **CORS**: Restrict to velro.ai domains only
5. **API Keys**: Store in environment variables, never commit to git

## CORS Configuration

```json
[
  {
    "AllowedOrigins": [
      "https://velro.ai",
      "https://*.velro.ai",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## File Structure After Migration

```
src/
├── lib/
│   ├── storage/
│   │   ├── r2-client.ts          # R2 client configuration
│   │   ├── r2-storage.ts         # Core R2 operations
│   │   └── r2-storage.test.ts    # Tests
│   ├── db/
│   │   └── helpers/
│   │       └── storage.ts         # Updated to use R2
│   ├── image/
│   │   └── image-storage.ts       # Updated to use R2
│   └── services/
│       └── video-storage.service.ts  # Updated to use R2
scripts/
└── migrate-supabase-to-r2.ts     # Migration script
```

## Implementation Order

1. **Setup R2 Infrastructure**
   - Create buckets
   - Generate API tokens
   - Configure environment variables

2. **Create R2 Storage Layer**
   - Install AWS SDK
   - Create R2 client
   - Implement core operations (upload, download, delete, presign)

3. **Update Storage Services**
   - Update `storage.ts` helpers
   - Update `image-storage.ts`
   - Update `video-storage.service.ts`

4. **Update Workflows**
   - Ensure workflows use updated storage services
   - Test workflow execution end-to-end

5. **Create Migration Script**
   - Implement Supabase → R2 copy logic
   - Add progress tracking and error handling

6. **Test Thoroughly**
   - Local development testing
   - Preview environment testing
   - Verify all file operations

7. **Migrate Data**
   - Run migration script
   - Verify data integrity

8. **Deploy to Production**
   - Deploy code changes
   - Monitor for issues
   - Keep Supabase as backup

## Success Criteria

- All existing files successfully migrated to R2
- New uploads go directly to R2
- Signed URLs work correctly for authenticated users
- Videos play in browser without CORS issues
- Images display correctly
- Workflows complete successfully
- No increase in error rates
- Cost reduction visible after 30 days

## Timeline

- **Week 1**: Implementation + Testing (Days 1-7)
- **Week 2**: Data Migration + Production Deployment (Days 8-14)
- **Week 3-6**: Monitoring + Optimization (Days 15-42)
- **Day 43**: Remove Supabase Storage (if no issues)

## Questions / Decisions

- [x] Use single bucket or multiple buckets per type? → Single bucket with prefixes
- [x] Public or private buckets? → Private with signed URLs
- [x] Custom domain for CDN? → Yes, optional (can add later)
- [x] Separate dev/prod buckets? → Yes (velro-storage-dev, velro-storage)
- [ ] Presigned URL expiration time? → Default 1 hour (configurable per use case)
- [ ] Migration script: batch size? → 100 files at a time
- [ ] Keep Supabase Storage backup for how long? → 30 days
