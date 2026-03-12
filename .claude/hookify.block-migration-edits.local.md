---
name: block-migration-edits
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: drizzle/migrations/
  - field: new_text
    operator: regex_match
    pattern: .+
---

🚫 **Direct migration directory edit blocked!**

Files in drizzle/migrations should **never be edited directly**.

**Per project rules:**

- Migrations are auto-generated from schema changes
- Use `bun db:generate:local` after modifying `src/lib/db/schema/`
- Never manually write migration SQL files

**If you need to fix a migration:**

1. Delete the problematic migration file
2. Remove its entry from `drizzle/migrations/meta/_journal.json`
3. Delete the corresponding snapshot in `drizzle/migrations/meta/`
4. Regenerate with `bun db:generate:local`

**If you need to undo a migration from the database:**

```sql
DELETE FROM __drizzle_migrations WHERE created_at >= <timestamp>;
```
