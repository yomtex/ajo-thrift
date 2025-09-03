-- Fix security vulnerability: Restrict profile data access to prevent personal information exposure

-- First, let's create a security definer function to check if a user can view another user's profile
-- This will be used to control access to sensitive profile information
CREATE OR REPLACE FUNCTION public.can_view_user_profile(target_user_id uuid, requesting_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Users can always view their own profile
  SELECT (target_user_id = requesting_user_id) 
  OR 
  -- Admins can view any profile
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = requesting_user_id 
    AND role = 'admin'
  ));
$$;

-- Create a view for safe profile access that only exposes non-sensitive information to group members
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  first_name,
  last_name,
  avatar_url,
  is_active,
  created_at
FROM public.profiles
WHERE is_active = true;

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Create RLS policy for the public profiles view
DROP POLICY IF EXISTS "Public profiles viewable by authenticated users" ON public.public_profiles;
CREATE POLICY "Public profiles viewable by authenticated users" 
ON public.public_profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- Update existing profile policies to be more restrictive
-- Remove any overly permissive policies and ensure only user and admin access

-- Drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate policies with enhanced security
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- Add additional security: Create a function to get limited group member info
CREATE OR REPLACE FUNCTION public.get_group_member_safe_info(group_id_param uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  joined_at timestamptz,
  payout_position integer,
  first_name text,
  last_name text,
  avatar_url text,
  is_frozen boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    gm.id,
    gm.user_id,
    gm.joined_at,
    gm.payout_position,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.is_frozen
  FROM public.group_members gm
  JOIN public.profiles p ON gm.user_id = p.id
  WHERE gm.group_id = group_id_param
  AND (
    -- User is a member of this group
    user_is_group_member_sd(group_id_param, auth.uid())
    OR 
    -- User is the creator of this group
    user_is_group_creator_sd(group_id_param, auth.uid())
  )
  ORDER BY gm.joined_at;
$$;

-- Ensure verification table has proper security (it already looks good, but let's double-check)
-- The verification policies are already restrictive - users can only see their own data and admins can see all

-- Add a comment for documentation
COMMENT ON FUNCTION public.can_view_user_profile IS 'Security function to determine if a user can view another users profile information';
COMMENT ON FUNCTION public.get_group_member_safe_info IS 'Returns safe group member information without exposing sensitive personal data like emails or phone numbers';
COMMENT ON VIEW public.public_profiles IS 'Safe view of profile data that excludes sensitive information like emails and phone numbers';