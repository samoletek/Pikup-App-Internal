# Supabase Email Confirmation Settings Fix

## Problem
The RLS policy error occurs because after `signUp()`, the user session is not automatically established if email confirmation is enabled. This means subsequent database operations fail RLS checks.

## Solution Options

### Option 1: Disable Email Confirmation (Recommended for Development)
1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Email Confirmations" section
3. **Disable** "Enable email confirmations"
4. Save changes

This allows users to sign up and immediately have an active session without needing to verify their email.

### Option 2: Use Database Trigger (Alternative)
Instead of creating the profile manually in code, let the database do it automatically:

```sql
-- Create a trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, user_type, first_name, last_name, rating)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'user_type',
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    5.0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

With this trigger, you can remove the manual profile creation from AuthContext.js.

## Recommended Action
**Try Option 1 first** - disable email confirmation in Supabase Dashboard for development/testing.
