-- knowledge_cases / knowledge_templates への権限付与
-- これらのテーブルはスキーマ外で作成されたため service_role/authenticated に明示的に GRANT が必要

GRANT SELECT ON public.knowledge_cases     TO service_role, authenticated;
GRANT SELECT ON public.knowledge_templates TO service_role, authenticated;
