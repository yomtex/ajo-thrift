-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Create RLS policies for KYC documents
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own KYC documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own KYC documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'kyc-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add document type column to verification table
ALTER TABLE verification ADD COLUMN IF NOT EXISTS document_type text;

-- Create enum for document types (optional, for better type safety)
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('drivers_license', 'nin', 'passport');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;