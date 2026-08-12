-- Restrict obsolete historical-import deletion RPCs.
--
-- The application uses delete_historical_import_v4() exclusively.
-- Earlier versions remain in the database for migration/history
-- compatibility, but authenticated application sessions no longer need
-- permission to execute them.
--
-- Keep delete_historical_import_v4(uuid) executable by authenticated users.
-- It performs its own organization owner/admin authorization.

revoke execute
on function public.delete_historical_import(uuid)
from authenticated;

revoke execute
on function public.delete_historical_import_v2(uuid)
from authenticated;

revoke execute
on function public.delete_historical_import_v3(uuid)
from authenticated;

grant execute
on function public.delete_historical_import_v4(uuid)
to authenticated;
