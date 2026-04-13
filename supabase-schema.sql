-- ============================================================
-- Roni's Pizza — QR Ordering System · Supabase Schema
-- Paste this into Supabase SQL Editor and hit Run
-- ============================================================

-- ─── Menu Items ───────────────────────────────────────────────────────────────
create table if not exists menu_items (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  price           integer not null,   -- base price in Rs (Medium)
  category        text not null,
  emoji           text default '🍕',
  available       boolean default true,
  customizations  jsonb default '[]'::jsonb,
  created_at      timestamptz default now()
);

-- ─── Seed: Classic Pizzas (M 1295 / L 1495) ──────────────────────────────────
insert into menu_items (name, description, price, category, emoji, available, customizations) values
(
  'Margherita',
  'Homemade Marinara Sauce, Mozzarella, Parmesan Dust',
  1295, 'Classic Pizzas', '🍕', true,
  '[{"label":"Size","options":["Medium – Rs 1295","Large – Rs 1495"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'Hawaiian Heat',
  'Homemade Marinara Sauce, Mozzarella, Chicken Chunks, Pineapple, Sweet Corn, Onion, Chilli Flakes',
  1295, 'Classic Pizzas', '🍕', true,
  '[{"label":"Size","options":["Medium – Rs 1295","Large – Rs 1495"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'Veggie Delight',
  'Homemade Marinara Sauce, Mozzarella, Onion, Capsicum, Mushroom, Sweet Corn, Jalapeño',
  1295, 'Classic Pizzas', '🍕', true,
  '[{"label":"Size","options":["Medium – Rs 1295","Large – Rs 1495"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'Marinara',
  'Homemade Marinara Sauce — on Thin Crust or Deep Pan',
  1295, 'Classic Pizzas', '🍕', true,
  '[{"label":"Size","options":["Medium – Rs 1295","Large – Rs 1495"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
);

-- ─── Seed: Roni's Specials (M 1595 / L 1995) ─────────────────────────────────
insert into menu_items (name, description, price, category, emoji, available, customizations) values
(
  'Fiery Tikka',
  'Homemade Marinara Sauce, Mozzarella, Chicken Tikka Chunks, Onion, Jalapeño, Green Chilli',
  1595, 'Roni''s Specials', '🔥', true,
  '[{"label":"Size","options":["Medium – Rs 1595","Large – Rs 1995"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'Roni''s Supreme',
  'Homemade Marinara Sauce, Mozzarella, Chicken Chunks, Chicken Sausages, Black Olives, Jalapeño, Mushrooms, Capsicum',
  1595, 'Roni''s Specials', '👑', true,
  '[{"label":"Size","options":["Medium – Rs 1595","Large – Rs 1995"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'Chicken Kebab',
  'Homemade Marinara Sauce, Mozzarella, Smokey Chicken Kebab Chunks, Onion, Capsicum, Jalapeño',
  1595, 'Roni''s Specials', '🍗', true,
  '[{"label":"Size","options":["Medium – Rs 1595","Large – Rs 1995"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'Chicken & Mushrooms',
  'Homemade Marinara Sauce, Mozzarella, Chicken Chunks, Mushroom, Black Olives',
  1595, 'Roni''s Specials', '🍄', true,
  '[{"label":"Size","options":["Medium – Rs 1595","Large – Rs 1995"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
);

-- ─── Seed: Protein Specials (M 1895 / L 2395) ────────────────────────────────
insert into menu_items (name, description, price, category, emoji, available, customizations) values
(
  'Beef Lover''s',
  'Homemade Marinara Sauce, Mozzarella, Minced Beef, Beef Sausages, Beef Pepperoni, Jalapeño, Onion, Capsicum',
  1895, 'Protein Specials', '🥩', true,
  '[{"label":"Size","options":["Medium – Rs 1895","Large – Rs 2395"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
),
(
  'OG Pepperoni',
  'Homemade Marinara Sauce, Mozzarella, Beef Pepperoni',
  1895, 'Protein Specials', '🍕', true,
  '[{"label":"Size","options":["Medium – Rs 1895","Large – Rs 2395"],"required":true},{"label":"Crust","options":["Thin Crust","Deep Pan"],"required":true}]'
);

-- ─── Seed: Drinks ─────────────────────────────────────────────────────────────
insert into menu_items (name, description, price, category, emoji, available, customizations) values
('Coca Cola', '350 ml', 120, 'Drinks', '🥤', true, '[]'),
('Sprite',    '350 ml', 120, 'Drinks', '🥤', true, '[]'),
('Water',     'Still mineral water', 90, 'Drinks', '💧', true, '[]');

-- ─── Seed: Extras (Make It Better) ───────────────────────────────────────────
insert into menu_items (name, description, price, category, emoji, available, customizations) values
(
  'Extra Protein', 
  'Add extra protein: Tikka Chunks, Beef Sausages, Minced Beef, or Pepperoni',
  245, 'Extras', '➕', true,
  '[{"label":"Protein","options":["Tikka Chunks","Beef Sausages","Minced Beef","Pepperoni"],"required":true}]'
),
(
  'Extra Cheese',
  'Extra mozzarella on your pizza',
  185, 'Extras', '🧀', true, '[]'
),
(
  'Extra Dip',
  'Chilli Oil, Tangy Jalapeño, or Creamy Garlic',
  95, 'Extras', '🫙', true,
  '[{"label":"Sauce","options":["Chilli Oil","Tangy Jalapeño","Creamy Garlic"],"required":true}]'
);

-- ─── Orders ───────────────────────────────────────────────────────────────────
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  table_number    text not null,
  customer_name   text,
  items           jsonb not null default '[]'::jsonb,
  status          text not null default 'new'
                  check (status in ('new', 'preparing', 'done', 'cancelled')),
  total           integer not null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-update updated_at on every order change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row execute procedure update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table menu_items enable row level security;
create policy "Anyone can read menu"  on menu_items for select using (true);
create policy "Staff can modify menu" on menu_items for all    using (auth.role() = 'authenticated');

alter table orders enable row level security;
create policy "Customers can place orders" on orders for insert with check (true);
create policy "Staff can view all orders"  on orders for select using (auth.role() = 'authenticated');
create policy "Staff can update orders"    on orders for update using (auth.role() = 'authenticated');

-- ─── Enable Realtime ──────────────────────────────────────────────────────────
-- Dashboard → Database → Replication → enable "orders" table
-- alter publication supabase_realtime add table orders;