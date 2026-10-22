import re

with open('implementation_plan_nextjs_vercel_final.md', 'r', encoding='utf-8') as f:
    plan = f.read()

# 1. Update Vision
plan = plan.replace(
    "> **A shared map and memory book for your friend group's café adventures.**\n> Life360 + Google Maps + Letterboxd, centered around cafés and friend-group memories.",
    "> **A shared real-time map for your circles, where cafés become the places your circle discovers, visits, rates, and remembers together.**\n> Life360 + Google Maps + Letterboxd, centered around Circles."
)

# 2. Update Architecture Overview
old_arch = """## Architecture Overview

```text
┌──────────────────────────────────────────────────────┐"""

new_arch = """## Architecture Overview (Circle-Centric)

### Core Object Hierarchy
```text
User
  │
  ├── Friends
  │
  └── Circles
       │
       ├── Members
       ├── Live Locations
       ├── Saved Cafés
       ├── Visits
       ├── Ratings
       ├── Memories
       ├── Activity
       └── Hangouts
```

**The Circle IS the map context.**
Switching Circles changes the entire map state (live locations, café markers, ratings, and memories).

```text
┌──────────────────────────────────────────────────────┐"""

plan = plan.replace(old_arch, new_arch)

# 3. Inject user_locations table into schema
schema_insert_point = "### Core Social\n\n#### `friends`"

new_schema_insert = """### Real-Time Tracking

#### `user_locations`
- `user_id` (uuid, primary key, references profiles)
- `circle_id` (uuid, references groups)
- `lat` (double precision)
- `lng` (double precision)
- `heading` (double precision, optional)
- `speed` (double precision, optional)
- `battery_level` (integer, optional)
- `updated_at` (timestamptz)
- **RLS**: Selectable by members of `circle_id`.

### Core Social

#### `friends`"""

plan = plan.replace(schema_insert_point, new_schema_insert)

# 4. Update the Database section intro to mention Circle-specific data
old_db_intro = """## Database Schema (Supabase)

All tables must enable RLS."""
new_db_intro = """## Database Schema (Supabase)

All tables must enable RLS. **Privacy Model:** The security model is now fundamentally "Can this user see this data inside this Circle?".

```text
User -> Circle Membership -> Circle Data
```
"""
plan = plan.replace(old_db_intro, new_db_intro)


with open('implementation_plan_nextjs_vercel_final.md', 'w', encoding='utf-8') as f:
    f.write(plan)

print("Plan successfully rewritten to be Circle-centric.")
