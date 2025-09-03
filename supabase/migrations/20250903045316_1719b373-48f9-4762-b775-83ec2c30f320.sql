-- Fix infinite recursion in RLS policies caused by circular dependency between thrift_groups and group_members tables
-- Create security definer functions to break the circular dependency

-- Function to check if user is a group member
CREATE OR REPLACE FUNCTION public.user_is_group_member_sd(group_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_id_param 
    AND user_id = user_id_param
  );
$$;

-- Function to check if user is group creator
CREATE OR REPLACE FUNCTION public.user_is_group_creator_sd(group_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.thrift_groups 
    WHERE id = group_id_param 
    AND creator_id = user_id_param
  );
$$;

-- Drop and recreate the problematic policies using security definer functions

-- Drop existing policies
DROP POLICY IF EXISTS "Group members can view their groups" ON public.thrift_groups;
DROP POLICY IF EXISTS "Group creators can view all group memberships" ON public.group_members;

-- Recreate policies using security definer functions
CREATE POLICY "Group members can view their groups" 
ON public.thrift_groups 
FOR SELECT 
USING (public.user_is_group_member_sd(id, auth.uid()));

CREATE POLICY "Group creators can view all group memberships" 
ON public.group_members 
FOR SELECT 
USING (public.user_is_group_creator_sd(group_id, auth.uid()));