---
name: block-migration-bash
enabled: true
event: bash
action: block
pattern: (rm|mv|cp|sed\s+-i|echo\s*>|tee|truncate).*drizzle/migrations|drizzle/migrations.*(>|>>)
---

🚫 **Direct migration directory modification blocked!**

You attempted to modify files in the drizzle/migrations directory via bash command.

The drizzle/migrations directory should **never be modified directly**.

**Note:** Reading migration files (cat, head, tail, less) is allowed for investigation.

**Per project rules:**

- Migrations are auto-generated from schema changes
- Use `bun db:generate:local` after modifying `src/lib/db/schema/`
- Never manually write, delete, or modify migration files or journal

**If you need to fix a migration, ask the user for permission first, then:**

1. Delete the problematic migration file
2. Remove its entry from `drizzle/migrations/meta/_journal.json`
3. Delete the corresponding snapshot in `drizzle/migrations/meta/`
4. Regenerate with `bun db:generate:local`
