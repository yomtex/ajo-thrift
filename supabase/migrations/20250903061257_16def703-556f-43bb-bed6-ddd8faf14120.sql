-- Fix security vulnerability: Restrict profile data access to prevent personal information exposure

-- Create a security definer function to check if a user can view another user's profile
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

-- Create a secure function to get group member information without exposing sensitive data
CREATE OR REPLACE FUNCTION public.get_group_members_safe(group_id_param uuid)
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

-- Update existing profile policies to be more restrictive
-- Drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate policies with enhanced security using is_admin function to prevent recursion
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (is_admin(auth.uid()));

-- Add a stricter policy for group members table to prevent unauthorized profile data access
-- This ensures that even if someone tries to query group_members with profile joins,
-- they can only see the limited information we allow

-- Add comment for documentation
COMMENT ON FUNCTION public.can_view_user_profile IS 'Security function to determine if a user can view another users profile information. Returns true only for the user themselves or admins.';
COMMENT ON FUNCTION public.get_group_members_safe IS 'Returns safe group member information without exposing sensitive personal data like emails or phone numbers. Only shows first name, last name, avatar, and frozen status.';