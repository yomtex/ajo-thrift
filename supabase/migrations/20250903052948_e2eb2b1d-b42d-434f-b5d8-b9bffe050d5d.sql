-- Add user freezing and reporting functionality
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('late_payment', 'scam', 'inappropriate_behavior', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  resolution_notes TEXT
);

-- Add frozen status to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN frozen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN frozen_reason TEXT;

-- Enable RLS on user_reports
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Group creators can create reports for their groups
CREATE POLICY "Group creators can create reports" 
ON public.user_reports 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.thrift_groups 
    WHERE id = group_id AND creator_id = auth.uid()
  ) AND auth.uid() = reporter_id
);

-- Group creators can view reports for their groups
CREATE POLICY "Group creators can view reports" 
ON public.user_reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.thrift_groups 
    WHERE id = group_id AND creator_id = auth.uid()
  )
);

-- Admins can view and update all reports
CREATE POLICY "Admins can view all reports" 
ON public.user_reports 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all reports" 
ON public.user_reports 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Users can view reports about themselves
CREATE POLICY "Users can view reports about themselves" 
ON public.user_reports 
FOR SELECT 
USING (auth.uid() = reported_user_id);

-- Add trigger for updated_at on user_reports
CREATE TRIGGER update_user_reports_updated_at
BEFORE UPDATE ON public.user_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for group_messages
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;