-- Remove unused authenticated DELETE privileges.
--
-- historical_imports:
-- Historical import deletion is performed through controlled SECURITY
-- DEFINER functions that perform their own organization authorization.
-- Authenticated application sessions do not require direct DELETE access.
--
-- public_event_settings:
-- Application users create and update public event settings but do not
-- directly delete them. Settings are removed automatically when their
-- parent event is deleted through the existing ON DELETE CASCADE foreign key.
--
-- Preserve all existing SELECT, INSERT, and UPDATE privileges and RLS
-- policies.

revoke delete
on table public.historical_imports
from authenticated;

revoke delete
on table public.public_event_settings
from authenticated;
