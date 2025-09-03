-- Fix security vulnerability: Restrict thrift_groups access to verified users and group members only

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view all active groups" ON public.thrift_groups;

-- Create new restrictive policies for viewing groups
CREATE POLICY "Group members can view their groups" 
ON public.thrift_groups 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = thrift_groups.id 
    AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Verified users can view recruiting groups" 
ON public.thrift_groups 
FOR SELECT 
USING (
  thrift_groups.status = 'recruiting' 
  AND EXISTS (
    SELECT 1 FROM public.verification 
    WHERE verification.user_id = auth.uid() 
    AND verification.verification_status = 'approved'
  )
);

CREATE POLICY "Group creators can view their own groups" 
ON public.thrift_groups 
FOR SELECT 
USING (auth.uid() = creator_id);