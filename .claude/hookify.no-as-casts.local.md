---
name: no-as-casts
enabled: true
event: file
conditions:
  - field: new_text
    operator: regex_match
    pattern: \bas\s+\w
---

**Type assertion (`as`) detected.**

Don't use `as` to cast types — it bypasses type safety. Instead:

- Fix the type at the source so it flows correctly
- Use `satisfies` for type narrowing
- Use type guards or runtime checks
- Use generics to propagate types
