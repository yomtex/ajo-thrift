-- Add end_date and target_amount to thrift_groups table
ALTER TABLE public.thrift_groups 
ADD COLUMN end_date date,
ADD COLUMN target_amount numeric;

-- Update the group_frequency enum to include daily, weekly, monthly, every
ALTER TYPE public.group_frequency ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE public.group_frequency ADD VALUE IF NOT EXISTS 'every';