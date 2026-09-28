# GitHub Workflow

## Branches

- `main` — stable household version
- `develop` — integration branch
- `legacy-import` — untouched snapshot of the current ZIP
- feature/refactor branches created from `develop`

Examples:

- `refactor/core-auth`
- `refactor/app-shell`
- `feature/grocery-location`
- `feature/home-maintenance`

## Pull request rule

Every meaningful change should answer:

- What changed?
- Why?
- What active pages are affected?
- What could break?
- How was it tested?
- Were any legacy files archived?

## Never commit

- service-role keys
- OpenAI/Anthropic secret keys
- passwords
- production database dumps containing personal data
