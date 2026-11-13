---
'@mlightcad/graphic-interface': minor
'@mlightcad/data-model': patch
---

`AcDbRenderingCache` no longer reuses a block template where it does not apply. Renderers can report `AcGiRenderer.cacheVariant` (for example while lineweights are forced on for a transient preview), and templates are cached per variant and per owning database. `AcDbRenderingCache.createScopedName()` returns the name a block is cached under. Before this change, a block drawn for a preview could come back with fat lines once committed, and blocks with the same name in two databases shared one template.
