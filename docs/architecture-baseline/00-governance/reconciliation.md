# Review disposition of prior artifacts
| Old document | Disposition | Essential fix |
|---|---|---|
| Requirements | Replaced | Authentication owner, phases, bounded revocation, product+tenant dimensions |
| 01 Solution Architecture | Replaced | Real trust boundaries and authoritative data ownership; no arbitrary realm/DAU limits |
| 02 API | Replaced | IdP endpoints not custom; policy route distinct; bound actor; exact auth/error semantics |
| 03 Security | Replaced | No immediate revocation claim with offline JWT; executable abuse tests |
| 04 Deployment | Replaced | SLO measurement, tested PITR and backup; no replica-as-backup claim |
| 05 SQL | Replaced | No password/session tables; composite scope FKs; audit/outbox; migration tests |
| 06 Roadmap | Replaced | Dependency-led gates instead of unsupported calendar promises |
| 07 Stories and CSV | Replaced | Story-to-test mapping; previous P0+P1 sum 157, not 164; no import-ready claim |
| Reviewed v2 bundle | Superseded | Adds concrete contracts, schema, tests, gates and ownership, but still requires execution evidence |

Residual pre-go-live risks: IdP config not yet verified; no live performance test or pentest; no production restore evidence; privacy decisions require counsel. Scope of review: text shown in project conversation; inaccessible artifact-only versions may differ.
