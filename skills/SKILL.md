# Skill: Stanley LLM Wiki Workflow

## 🎯 Description
Use this skill when building or maintaining the **Stanley** knowledge base. This includes ingesting sources, querying history, and linting the wiki layer.

## 🏗️ The Three-Layer Setup
- **00_RAW/** — Immutable source material. Organized by `00_RAW/<topic>/YYYY-MM-DD-slug.md`.
- **01_WIKI/** — Compiled concept articles. Organized by `01_WIKI/<topic>/Concept-Name.md`.
- **02_PROJECTS/** — Production rooms. Organized by `02_PROJECTS/<Project-Status>/Brief.md`, etc.

## 📥 Ingestion Workflow
1. **Fetch**: Clean content and save to `00_RAW` subdirectory.
   - Use metadata header: Source URL, Collected Date, Published Date.
2. **Compile**:
   - Merge into existing wiki article if the thesis is the same.
   - Create new wiki article for new concepts.
   - Conflict Check: Annotate contradictions with source attribution.
3. **Index & Log**:
   - Update `01_WIKI/index.md`.
   - Append entry to `01_WIKI/log.md`.

## 🔍 Query Workflow
1. Read `01_WIKI/index.md` to locate pages.
2. Synthesize answer using wiki content primarily.
3. Cite sources with [[wiki/topic/article.md]] links.

## 🧹 Linting Workflow
- **Auto-Fix**: Fix broken links, update index entries, and correct Raw references.
- **Report**: Contradictions, outdated claims, or missing connections.

## 📝 Templates
| Type | Location |
| :--- | :--- |
| Raw Header | `Collected: YYYY-MM-DD \| Published: YYYY-MM-DD \| Source: URL` |
| Article Header | `Sources: Author (Date) \| Raw: [[raw/topic/file.md]]` |
| Log Entry | `## [YYYY-MM-DD] <operation> \| <summary>` |
