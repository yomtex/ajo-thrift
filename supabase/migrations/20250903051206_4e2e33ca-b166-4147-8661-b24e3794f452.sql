-- Create join requests table for group member approvals
CREATE TABLE public.group_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  UNIQUE(user_id, group_id)
);

-- Create group chat messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for join requests
CREATE POLICY "Users can view their own join requests" 
ON public.group_join_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own join requests" 
ON public.group_join_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Group creators can view group join requests" 
ON public.group_join_requests 
FOR SELECT 
USING (public.user_is_group_creator_sd(group_id, auth.uid()));

CREATE POLICY "Group creators can update join requests" 
ON public.group_join_requests 
FOR UPDATE 
USING (public.user_is_group_creator_sd(group_id, auth.uid()));

-- RLS policies for group messages
CREATE POLICY "Group members can view messages" 
ON public.group_messages 
FOR SELECT 
USING (public.user_is_group_member_sd(group_id, auth.uid()) OR public.user_is_group_creator_sd(group_id, auth.uid()));

CREATE POLICY "Group members can create messages" 
ON public.group_messages 
FOR INSERT 
WITH CHECK ((public.user_is_group_member_sd(group_id, auth.uid()) OR public.user_is_group_creator_sd(group_id, auth.uid())) AND auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" 
ON public.group_messages 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_group_messages_updated_at
BEFORE UPDATE ON public.group_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();