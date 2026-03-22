---
name: block-db-transaction
enabled: true
event: file
action: block
conditions:
  - field: new_text
    operator: regex_match
    pattern: \.transaction\s*\(
---

**D1/Cloudflare does not support interactive transactions (BEGIN/COMMIT).**

`db.transaction()` will fail at runtime with: `"Failed query: begin params:"`

**Instead, use sequential queries:**

1. Query data with `db.select()`
2. Validate in application code
3. Insert/update with `db.insert()` or `db.update()`
4. Use unique indexes + `onConflictDoNothing()` to prevent race conditions

See commit `f31442b` and issue #401 for the established pattern.
