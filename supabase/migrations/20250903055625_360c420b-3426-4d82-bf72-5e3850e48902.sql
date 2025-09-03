-- Add payout functionality to the database
-- Add payout tracking table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  recipient_user_id UUID NOT NULL,
  cycle_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  payout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, cycle_number)
);

-- Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Create policies for payouts
CREATE POLICY "Group members can view payouts" ON public.payouts
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = payouts.group_id 
    AND user_id = auth.uid()
  ));

CREATE POLICY "Group creators can create payouts" ON public.payouts
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.thrift_groups 
    WHERE id = payouts.group_id 
    AND creator_id = auth.uid()
  ));

CREATE POLICY "Group creators can update payouts" ON public.payouts
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.thrift_groups 
    WHERE id = payouts.group_id 
    AND creator_id = auth.uid()
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();