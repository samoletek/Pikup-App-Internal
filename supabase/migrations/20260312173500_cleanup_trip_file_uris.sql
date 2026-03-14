-- Remove device-local file URIs from historical trip payloads.
-- We keep only remotely accessible URLs in DB-facing fields.

with prepared as (
  select
    t.id,
    t.items::jsonb as original_items,
    t.pickup_photos as original_pickup_photos,
    t.dropoff_photos as original_dropoff_photos,
    (
      select coalesce(
        jsonb_agg(
          case
            when jsonb_typeof(item) = 'object' then
              jsonb_set(
                case
                  when jsonb_typeof(item->'invoicePhoto') = 'string'
                    and item->>'invoicePhoto' ~* '^file://'
                    then jsonb_set(item, '{invoicePhoto}', 'null'::jsonb, true)
                  else item
                end,
                '{photos}',
                (
                  select coalesce(jsonb_agg(to_jsonb(photo_url)), '[]'::jsonb)
                  from (
                    select value as photo_url
                    from jsonb_array_elements_text(
                      case
                        when jsonb_typeof(item->'photos') = 'array' then item->'photos'
                        else '[]'::jsonb
                      end
                    )
                    where value !~* '^file://'
                  ) as filtered_photos
                ),
                true
              )
            else item
          end
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(coalesce(t.items::jsonb, '[]'::jsonb)) = 'array'
            then coalesce(t.items::jsonb, '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as item
    ) as cleaned_items,
    (
      select coalesce(array_agg(url), array[]::text[])
      from unnest(coalesce(t.pickup_photos, array[]::text[])) as url
      where url !~* '^file://'
    ) as cleaned_pickup_photos,
    (
      select coalesce(array_agg(url), array[]::text[])
      from unnest(coalesce(t.dropoff_photos, array[]::text[])) as url
      where url !~* '^file://'
    ) as cleaned_dropoff_photos
  from public.trips t
  where
    coalesce(t.items::text, '') like '%file://%'
    or exists (
      select 1
      from unnest(coalesce(t.pickup_photos, array[]::text[])) as url
      where url ~* '^file://'
    )
    or exists (
      select 1
      from unnest(coalesce(t.dropoff_photos, array[]::text[])) as url
      where url ~* '^file://'
    )
)
update public.trips as t
set
  items = prepared.cleaned_items,
  pickup_photos = prepared.cleaned_pickup_photos,
  dropoff_photos = prepared.cleaned_dropoff_photos,
  updated_at = now()
from prepared
where t.id = prepared.id
  and (
    prepared.cleaned_items <> prepared.original_items
    or prepared.cleaned_pickup_photos <> prepared.original_pickup_photos
    or prepared.cleaned_dropoff_photos <> prepared.original_dropoff_photos
  );
