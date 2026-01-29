-- Fix RLS policy for profiles table to allow signup
-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a new INSERT policy that allows authenticated users to create their profile
-- This works during signup because the user is authenticated after auth.signUp()
CREATE POLICY "Authenticated users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
