# Security Checklist

Risk level: Medium. A hook does not custody funds in this example, but a
production hook can reject protocol actions or change swap fees.

- [x] No program-owned state, token custody, PDA signing, or external CPI.
- [x] Malformed callback data returns a typed error instead of panicking.
- [x] Unknown action values are rejected.
- [x] Return data uses the exact 32-byte callback layout.
- [x] Fee fields default to `0xffff` so the caller keeps its configured values.
- [ ] A production policy must validate every account it reads, including key,
      owner, signer, writable status, and cross-account relationships.
- [ ] A production payload format must have an explicit version, exact length
      checks, bounded values, and tests for malformed input.
- [ ] Test all enabled Initializer or CPMM actions in an integration environment
      before deployment.
- [ ] Replace the example program ID and arrange protocol allowlisting before use.

Known limitation: this example deliberately allows every recognized action and
does not implement a policy. It is an ABI reference, not a production policy.
