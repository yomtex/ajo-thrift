-- Fix transactions table RLS policies to allow users to insert their own transactions
CREATE POLICY "Users can insert their own transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow admins to insert transactions (for system operations)
CREATE POLICY "Admins can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

-- Allow users to update their own transactions (for status updates, etc.)
CREATE POLICY "Users can update their own transactions" 
ON public.transactions 
FOR UPDATE 
USING (auth.uid() = user_id);