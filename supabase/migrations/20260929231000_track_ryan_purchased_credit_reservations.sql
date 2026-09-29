create or replace function public.consume_ryan_message(p_organization_id uuid, p_agent_id uuid, p_conversation_id uuid, p_customer_id uuid, p_model text)
returns table(run_id uuid, allowed boolean, used_messages bigint, plan_messages bigint, purchased_messages bigint, total_limit bigint, remaining_messages bigint, reset_at timestamptz)
language plpgsql
set search_path = public
as $$
declare
  plan_value bigint := 0;
  purchased_balance bigint := 0;
  used_value bigint := 0;
  new_run_id uuid;
  purchase_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
  select coalesce((p.limits->>'ai_messages')::bigint,0) into plan_value
  from subscriptions s join plans p on p.id=s.plan_id
  where s.organization_id=p_organization_id and s.status in ('active','trialing')
    and coalesce(s.expires_at,s.renewal_date)>=current_date
  order by coalesce(s.expires_at,s.renewal_date) desc nulls last limit 1;
  plan_value:=coalesce(plan_value,0);
  select count(*)::bigint into used_value
  from ai_agent_runs r join ai_agents a on a.id=r.agent_id
  where a.organization_id=p_organization_id and r.created_at>=date_trunc('month',now())
    and r.status not in ('failed','error','cancelled');
  select coalesce(sum(greatest(messages-consumed_messages,0)),0)::bigint into purchased_balance
  from ryan_credit_purchases where organization_id=p_organization_id and status='approved';

  if used_value >= plan_value then
    if purchased_balance <= 0 then
      return query select null::uuid,false,used_value,plan_value,purchased_balance,plan_value+purchased_balance,0::bigint,date_trunc('month',now())+interval '1 month';
      return;
    end if;
    select id into purchase_id from ryan_credit_purchases
    where organization_id=p_organization_id and status='approved' and messages>consumed_messages
    order by purchased_at asc nulls last,created_at asc,id asc limit 1 for update;
    if purchase_id is null then
      return query select null::uuid,false,used_value,plan_value,purchased_balance,plan_value+purchased_balance,0::bigint,date_trunc('month',now())+interval '1 month';
      return;
    end if;
    update ryan_credit_purchases set consumed_messages=consumed_messages+1 where id=purchase_id;
  end if;

  insert into ai_agent_runs(agent_id,conversation_id,customer_id,model,status,input_tokens,output_tokens,tool_calls,metadata)
  values(
    p_agent_id,p_conversation_id,p_customer_id,p_model,'processing',0,0,'[]'::jsonb,
    jsonb_build_object('source','ryan','billing_month',date_trunc('month',now()))
    || case when purchase_id is not null then jsonb_build_object('purchased_credit_id',purchase_id) else '{}'::jsonb end
  )
  returning id into new_run_id;

  return query select new_run_id,true,used_value+1,plan_value,purchased_balance,plan_value+purchased_balance,
    greatest(plan_value+purchased_balance-(used_value+1),0),date_trunc('month',now())+interval '1 month';
end;
$$;
