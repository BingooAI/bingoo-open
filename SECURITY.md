# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through
[GitHub Security Advisories](https://github.com/BingooAI/bingoo-open/security/advisories/new),
or email **security@bingoo.ai**.

Please include: what the issue is, how to reproduce it, which version or commit, and what an
attacker could achieve. A proof of concept helps enormously.

**What to expect:** acknowledgement within 3 working days, an initial assessment within 7,
and regular updates until it is resolved. We will credit you in the advisory unless you
prefer otherwise. We are a small team — if you have not heard back within a week, please
chase us; it means something went wrong, not that we are ignoring you.

## Why this package matters more than its size suggests

It has no runtime behaviour and one dependency, so its own attack surface is small. But it
sits above every repository in the family, and a compromise of this package is a compromise
of all of them. Supply-chain integrity is the primary security property here, ahead of
anything in the code.

That is why: Actions are pinned by commit SHA, releases carry npm provenance, maintainers use
2FA, and the dependency list is asserted by CI rather than merely reviewed.

## Supported versions

Pre-1.0, only the latest release is supported. Once 1.0 ships, the current major receives
security fixes and the previous major receives them for six months.

## Scope

**In scope:** the schemas and types in this repository, the release and supply-chain process,
and any way a malformed document could cause disproportionate harm when parsed — unbounded
allocation, catastrophic backtracking in a regular expression, prototype pollution through a
passthrough object.

That last category is the realistic one. This package parses data arriving from registries,
publishers and school LRSs, and "the source was respectable" is not a security property.

**Out of scope:** vulnerabilities in `zod` itself (report those upstream; tell us too if the
family is affected); weaknesses in the standards we map, as opposed to our mapping of them;
and issues in the consuming repositories, which have their own policies.

## What is deliberately not here

**There is no student personal data in this package, and there never will be** (ENGINEERING
R10). Learners are an opaque identifier. No name, no birth date, no roster, no behaviour note.

If you find a field that could carry personal data, that is a design bug worth reporting even
if it is not exploitable — the guarantee is what makes a portable profile safe to hand to
another institution, and it is easier to keep than to restore.

## Hardening we hold ourselves to

- **Every string and array is bounded.** An unbounded `z.string()` parsed from an upload is a
  memory-exhaustion primitive.
- **No `z.any()`.** `z.unknown()`, and the consumer narrows it.
- **`.loose()` is deliberate and documented** where a standard requires extensibility — never
  a shortcut past a field somebody did not want to model.
- **No I/O, no network, no filesystem, no environment access.** Enforced by lint, not by
  convention.

## Disclosure

Coordinated. We will agree a timeline with you, publish an advisory, and credit you. If a fix
requires a release across several repositories in the family, we will say so and give you the
schedule.
