<!-- Generated from kanon/catalog/reliability.json in codysseydev/codyssey-skills by "node kanon/scripts/catalog.mjs generate". Do not edit by hand. -->

# Reliability

Applies to: batch imports, bulk jobs and other code that processes many independent records in one run.

## Batch processing

- `REL-001` A batch import **SHOULD** catch per-row domain failures, record the row's source reference, and continue with the remaining rows. One bad row should not discard the good ones, and the recorded reference lets someone fix and re-run that row.
