-- The trigger runs as owner; no one should call this over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
