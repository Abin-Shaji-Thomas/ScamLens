-- Supabase only (run after schema.sql). Locks tables and functions to the server's service-role key:
-- the public anon key can neither read reports nor call the functions.
alter table reports enable row level security;
alter table graph_edges enable row level security;
alter table flagged_addresses enable row level security;
alter table exchange_addresses enable row level security;

revoke all on reports, graph_edges, flagged_addresses, exchange_addresses from anon, authenticated;
revoke all on active_edges, co_edges from anon, authenticated;
revoke execute on function submit_report, reported_counts, contest_identifier, hub_nodes,
  q1_upi_wallet_telegram, q2_payment_to_flagged, q3_telegram_clusters, q4_neighbourhood,
  add_payment_edge, add_flagged, add_exchange
  from public, anon, authenticated;
grant execute on function submit_report, reported_counts, contest_identifier, hub_nodes,
  q1_upi_wallet_telegram, q2_payment_to_flagged, q3_telegram_clusters, q4_neighbourhood,
  add_payment_edge, add_flagged, add_exchange
  to service_role;
