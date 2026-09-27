revoke execute on function public.riftcore_operator_role() from anon;
revoke execute on function public.get_my_operator_profile() from anon;
revoke execute on function public.list_tournament_registrations(text) from anon;
revoke execute on function public.set_registration_status(uuid, text) from anon;
revoke execute on function public.set_registration_check_in(uuid, boolean) from anon;
revoke execute on function public.get_tournament_registration_summary(text) from anon;

grant execute on function public.riftcore_operator_role() to authenticated;
grant execute on function public.get_my_operator_profile() to authenticated;
grant execute on function public.list_tournament_registrations(text) to authenticated;
grant execute on function public.set_registration_status(uuid, text) to authenticated;
grant execute on function public.set_registration_check_in(uuid, boolean) to authenticated;
grant execute on function public.get_tournament_registration_summary(text) to authenticated;
