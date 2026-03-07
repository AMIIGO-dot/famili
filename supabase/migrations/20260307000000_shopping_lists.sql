-- FAMILJ – Shopping Lists
-- Parents-only feature: shopping lists linked to events.

-- ─── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL REFERENCES public.families(id)  ON DELETE CASCADE,
  event_id    UUID        NOT NULL REFERENCES public.events(id)    ON DELETE CASCADE,
  created_by  UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID        NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  text        TEXT        NOT NULL,
  is_checked  BOOLEAN     NOT NULL DEFAULT false,
  checked_by  UUID,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS shopping_lists_family_id_idx  ON public.shopping_lists(family_id);
CREATE INDEX IF NOT EXISTS shopping_lists_event_id_idx   ON public.shopping_lists(event_id);
CREATE INDEX IF NOT EXISTS shopping_items_list_id_idx     ON public.shopping_list_items(list_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.shopping_lists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items  ENABLE ROW LEVEL SECURITY;

-- Only parent members of the family can access shopping lists
CREATE POLICY "parents can manage shopping lists"
  ON public.shopping_lists FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   public.members m
      WHERE  m.family_id = shopping_lists.family_id
        AND  m.user_id   = auth.uid()
        AND  m.role      = 'parent'
    )
  );

-- Only parent members of the owning family can access items
CREATE POLICY "parents can manage shopping list items"
  ON public.shopping_list_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   public.shopping_lists sl
      JOIN   public.members m ON m.family_id = sl.family_id
      WHERE  sl.id       = shopping_list_items.list_id
        AND  m.user_id   = auth.uid()
        AND  m.role      = 'parent'
    )
  );

-- Enable Realtime on both tables (run once in the Supabase dashboard if not already enabled)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list_items;
