-- Fix infinite recursion in group_members RLS policies

-- First, let's check and fix the circular reference issue
-- The current policy might be referencing group_members table within itself

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view memberships of groups they belong to" ON public.group_members;

-- Create a security definer function to check group membership without recursion
CREATE OR REPLACE FUNCTION public.user_is_group_member(group_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_id_param 
    AND user_id = user_id_param
  );
$$;

-- Create new non-recursive policies for group_members
CREATE POLICY "Users can view their own memberships" 
ON public.group_members 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Group creators can view all group memberships" 
ON public.group_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.thrift_groups 
    WHERE thrift_groups.id = group_members.group_id 
    AND thrift_groups.creator_id = auth.uid()
  )
);