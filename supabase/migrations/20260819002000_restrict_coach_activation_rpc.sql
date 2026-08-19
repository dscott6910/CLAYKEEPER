-- ============================================================
-- ClayKeeper
-- Restrict Coach Account Activation RPC Access
--
-- Coach invitation creation and redemption require an
-- authenticated ClayKeeper account. Remove anonymous execute
-- access explicitly.
-- ============================================================

revoke execute
on function public.create_coach_account_invitation(uuid, text)
from anon;

revoke execute
on function public.redeem_coach_account_invitation(text)
from anon;

revoke execute
on function public.create_coach_account_invitation(uuid, text)
from public;

revoke execute
on function public.redeem_coach_account_invitation(text)
from public;

grant execute
on function public.create_coach_account_invitation(uuid, text)
to authenticated;

grant execute
on function public.redeem_coach_account_invitation(text)
to authenticated;
