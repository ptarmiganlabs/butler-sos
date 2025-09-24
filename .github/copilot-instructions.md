---
applyTo: '**'
---

# copilot-instructions.md

This file provides guidance to Copilot when working with code in this repository.

## 📚 Onboarding

At the start of each session, read:

1. Any `**/README.md` docs across the project
2. Any `**/README.*.md` docs across the project

## ✅ Quality Gates

When writing code, Copilot must not finish until all of these succeed:

1. `npm run lint:fix`
2. All unit tests (`npm run test`) pass

If any check fails, fix the issues and run checks again.
