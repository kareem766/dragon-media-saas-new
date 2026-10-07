-- Step 4 — Harden payment request input constraints
-- No active pending/approved duplicate references were found before this migration.
alter table public.payment_requests
  add constraint pr_receipt_https
    check (receipt_url is null or receipt_url ~* '^https://')
    not valid,
  add constraint pr_reference_len
    check (reference is null or length(reference) <= 100)
    not valid,
  add constraint pr_note_len
    check (note is null or length(note) <= 1000)
    not valid;

create unique index if not exists payment_requests_ref_uniq
  on public.payment_requests (method, lower(trim(reference)))
  where status in ('pending_review','approved') and reference is not null;
