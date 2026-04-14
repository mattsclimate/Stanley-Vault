# Vault Map: vault_map.md

## 🏗️ Architecture Overview
Stanley operations follow a **Three-Layer Architecture**:

| Layer | Directory | Purpose | Access Level |
| :--- | :--- | :--- | :--- |
| **00_RAW** | `00_RAW/` | Immutable sources (PDFs, Transcripts, etc.) | Read-Only |
| **01_WIKI** | `01_WIKI/` | Compiled concepts, entities, and summaries | AI-Managed |
| **02_PROJECTS** | `02_PROJECTS/` | Active production workspace ("Rooms") | Collaborative |

## 📁 Folder Conventions
- `skills/`: Tooling and routine library for standard operations.
- `01_WIKI/index.md`: The central content database.
- `01_WIKI/log.md`: The append-only chronology of all agent activity.

## 🏷️ Naming Conventions
- **Raw Sources**: `YYYY-MM-DD-descriptive-slug.md`
- **Wiki Articles**: Concept-based (e.g., `Transformer-Model.md` or `DeepSeek-V3.md`), not source-based.
- **Projects**: `YYYY-MM-Project-Name_Status` (Status: `Draft`, `Active`, `Done`).

## 🗺️ Navigation Logic
1. **Ingest**: Put source in `00_RAW` -> Agent processes -> Updates `01_WIKI`.
2. **Query**: Agent searches `01_WIKI/index.md` -> Reads relevant notes -> Synthesizes answer.
3. **Build**: Project initiated in `02_PROJECTS` -> Progression: `Brief` -> `Spec` -> `Build` -> `Output`.
