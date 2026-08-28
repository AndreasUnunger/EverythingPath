# Define the CI Failure and Flake Policy

Type: grilling
Status: resolved
Blocked by: 01, 06, 07

## Question

What artifacts, retries, quarantine rules, ownership, triage expectations, and escalation thresholds should govern the pull-request and nightly suites so failures remain actionable and flaky checks cannot silently stop protecting the product?

## Answer

Use one CI-only retry to collect diagnostic evidence, with Playwright's flaky-test enforcement enabled so both a persistent failure and a retry-pass remain red. Tests must be isolated and repeatable across attempts because Playwright replaces the failed worker and browser before retrying. A later green rerun does not by itself erase an earlier failure: the pull request may proceed only after a code or configuration fix, or after a documented external-infrastructure incident followed by a clean run of the unchanged commit.

Do not support quarantines, waivers that disable checks, or committed skipped tests. Reject `test.skip`, `test.fixme`, committed focused tests, and equivalent constructs. Gate and nightly membership are separate intentional suites, but every test assigned to either suite must execute.

The pull-request author owns initial failure triage. Ownership transfers to the suite maintainer only after the failure is shown to come from shared E2E infrastructure. Pull-request failures must be resolved before merge under the rerun rule above. Nightly failures have no calendar response deadline and never pause unrelated development. When the same test fails on two consecutive runs or at least twice within 20 runs, create or update one deduplicated issue. Resolve that recurring failure before releasing or materially changing the affected journey.

Publish a concise console result, Playwright HTML report, first-retry trace, failure screenshots, and safe application/service logs. Leave video disabled unless traces prove insufficient. Retain artifacts for 30 days. Never upload authentication storage state, credentials, secrets, or production data.

Protect the gate with one stable, uniquely named aggregate required check that always runs for pull requests and merge-queue events. It must fail unless every required journey reports success; flaky, failed, cancelled, neutral, skipped, and missing results are all failures. Do not use `continue-on-error` for required results.

Keep the existing 15-minute outer workflow timeout, but stop the E2E execution step after 12 minutes so report finalization and artifact upload have three minutes of headroom. A timeout blocks the merge and follows the same evidence and triage policy as any other failure.

Primary-source support for the retry, artifact, timeout, and required-check mechanics is recorded in `../research/ci-failure-flake-policy.md`.
