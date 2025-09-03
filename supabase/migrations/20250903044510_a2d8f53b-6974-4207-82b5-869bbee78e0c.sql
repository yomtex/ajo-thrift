-- Fix infinite recursion in RLS policies by updating is_admin function
-- The issue is that is_admin function queries profiles table which has policies that also use is_admin
-- Creating a new version that uses SECURITY DEFINER to bypass RLS

DROP FUNCTION IF EXISTS public.is_admin(uuid);

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;