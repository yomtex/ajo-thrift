-- Fix RLS policies for contributions table
-- First, let's ensure contributions table has proper policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own contributions" ON public.contributions;
DROP POLICY IF EXISTS "Group members can view group contributions" ON public.contributions;

-- Create comprehensive RLS policies for contributions
CREATE POLICY "Users can view their own contributions" 
ON public.contributions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Group members can view group contributions" 
ON public.contributions 
FOR SELECT 
USING (user_is_group_member_sd(group_id, auth.uid()));

CREATE POLICY "Group creators can view all group contributions" 
ON public.contributions 
FOR SELECT 
USING (user_is_group_creator_sd(group_id, auth.uid()));

CREATE POLICY "Group creators can insert contributions" 
ON public.contributions 
FOR INSERT 
WITH CHECK (user_is_group_creator_sd(group_id, auth.uid()));

CREATE POLICY "Group creators can update contributions" 
ON public.contributions 
FOR UPDATE 
USING (user_is_group_creator_sd(group_id, auth.uid()));

CREATE POLICY "Users can update their own contribution status" 
ON public.contributions 
FOR UPDATE 
USING (auth.uid() = user_id);