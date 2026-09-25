-- Company knowledge base is tenant-scoped and intentionally add-only for authenticated company users.
-- Ryan configuration remains platform-owner-only at the application route level.

DROP POLICY IF EXISTS knowledge_base_update ON public.knowledge_base;
DROP POLICY IF EXISTS knowledge_base_delete ON public.knowledge_base;
DROP POLICY IF EXISTS knowledge_base_select ON public.knowledge_base;
DROP POLICY IF EXISTS knowledge_base_insert ON public.knowledge_base;

CREATE POLICY knowledge_base_select
ON public.knowledge_base
FOR SELECT
TO authenticated
USING (
  organization_id = current_organization_id()
  AND NOT org_is_suspended(organization_id)
  AND subscription_is_active(organization_id)
  AND subscription_has_feature(organization_id, 'ryan'::text)
);

CREATE POLICY knowledge_base_insert
ON public.knowledge_base
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = current_organization_id()
  AND NOT org_is_suspended(organization_id)
  AND subscription_is_active(organization_id)
  AND subscription_has_feature(organization_id, 'ryan'::text)
);
