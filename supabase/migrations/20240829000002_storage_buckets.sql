-- Create storage buckets for media assets
-- Note: In newer Supabase versions, bucket configuration (file size limits, mime types)
-- is managed through the Supabase Dashboard or Storage API, not SQL migrations.
-- This migration only creates the bucket records; configure limits via Dashboard.

-- Insert bucket configurations into storage.buckets table
INSERT INTO storage.buckets (id, name)
VALUES
    -- Thumbnails bucket for frame images (public via RLS policies)
    -- Recommended: 10MB limit, image/* mime types
    ('thumbnails', 'thumbnails'),

    -- Videos bucket for generated video clips (public via RLS policies)
    -- Recommended: 500MB limit, video/* mime types
    ('videos', 'videos'),

    -- Characters bucket for LoRA model files and previews (public via RLS policies)
    -- Recommended: 100MB limit, image/* and application/octet-stream
    ('characters', 'characters'),

    -- Styles bucket for style preview images (public via RLS policies)
    -- Recommended: 10MB limit, image/* mime types
    ('styles', 'styles'),

    -- Audio bucket for sound effects and music (public via RLS policies)
    -- Recommended: 50MB limit, audio/* mime types
    ('audio', 'audio'),

    -- Scripts bucket for uploaded script files (private via RLS policies)
    -- Recommended: 5MB limit, text/*, application/pdf, .docx
    ('scripts', 'scripts'),

    -- Exports bucket for final exported videos (private via RLS policies)
    -- Recommended: 2GB limit, video/*, application/zip
    ('exports', 'exports')
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for storage buckets
-- Note: These are permissive for service role, restrictive for others

-- Thumbnails: Public read, authenticated write
CREATE POLICY "Thumbnails public read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'thumbnails');
    
CREATE POLICY "Thumbnails authenticated upload" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');
    
CREATE POLICY "Thumbnails user update" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
    
CREATE POLICY "Thumbnails user delete" ON storage.objects 
    FOR DELETE USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Videos: Public read, authenticated write
CREATE POLICY "Videos public read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'videos');
    
CREATE POLICY "Videos authenticated upload" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');
    
CREATE POLICY "Videos user update" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
    
CREATE POLICY "Videos user delete" ON storage.objects 
    FOR DELETE USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Characters: Public read, authenticated write
CREATE POLICY "Characters public read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'characters');
    
CREATE POLICY "Characters authenticated upload" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'characters' AND auth.role() = 'authenticated');

-- Styles: Public read, authenticated write
CREATE POLICY "Styles public read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'styles');
    
CREATE POLICY "Styles authenticated upload" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'styles' AND auth.role() = 'authenticated');

-- Audio: Public read, authenticated write
CREATE POLICY "Audio public read" ON storage.objects 
    FOR SELECT USING (bucket_id = 'audio');
    
CREATE POLICY "Audio authenticated upload" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'audio' AND auth.role() = 'authenticated');

-- Scripts: Private - only team members can access
CREATE POLICY "Scripts team read" ON storage.objects 
    FOR SELECT USING (
        bucket_id = 'scripts' AND
        auth.uid() IN (
            SELECT user_id FROM team_members 
            WHERE team_id::text = (storage.foldername(name))[1]
        )
    );
    
CREATE POLICY "Scripts team upload" ON storage.objects 
    FOR INSERT WITH CHECK (
        bucket_id = 'scripts' AND
        auth.uid() IN (
            SELECT user_id FROM team_members 
            WHERE team_id::text = (storage.foldername(name))[1]
        )
    );

-- Exports: Private - only team members can access
CREATE POLICY "Exports team read" ON storage.objects 
    FOR SELECT USING (
        bucket_id = 'exports' AND
        auth.uid() IN (
            SELECT user_id FROM team_members 
            WHERE team_id::text = (storage.foldername(name))[1]
        )
    );
    
CREATE POLICY "Exports team upload" ON storage.objects 
    FOR INSERT WITH CHECK (
        bucket_id = 'exports' AND
        auth.uid() IN (
            SELECT user_id FROM team_members 
            WHERE team_id::text = (storage.foldername(name))[1]
        )
    );