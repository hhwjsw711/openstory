-- Create storage buckets for media assets
-- Note: This SQL creates the bucket records, actual bucket creation happens via Supabase Storage API

-- Insert bucket configurations into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    -- Thumbnails bucket for frame images
    ('thumbnails', 'thumbnails', true, 10485760, -- 10MB limit
     ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
    
    -- Videos bucket for generated video clips
    ('videos', 'videos', true, 524288000, -- 500MB limit
     ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']),
    
    -- Characters bucket for LoRA model files and previews
    ('characters', 'characters', true, 104857600, -- 100MB limit
     ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/octet-stream']),
    
    -- Styles bucket for style preview images
    ('styles', 'styles', true, 10485760, -- 10MB limit
     ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
    
    -- Audio bucket for sound effects and music
    ('audio', 'audio', true, 52428800, -- 50MB limit
     ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']),
    
    -- Scripts bucket for uploaded script files
    ('scripts', 'scripts', false, 5242880, -- 5MB limit
     ARRAY['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    
    -- Exports bucket for final exported videos
    ('exports', 'exports', false, 2147483648, -- 2GB limit
     ARRAY['video/mp4', 'video/webm', 'application/zip'])
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

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