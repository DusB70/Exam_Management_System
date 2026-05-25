# Git Branching Strategy & Workflow Guidelines

To maintain code quality, stability, and clean audit logs, we adopt a structured **Git Flow** strategy adapted for monorepos.

## Branch Conventions

1. **`main`**: Production-ready code only. Direct commits are blocked. Changes arrive via Pull Requests (PRs) from `develop` after QA sign-off.
2. **`develop`**: The main integration branch. All feature branches merge into `develop`.
3. **`feature/*`**: Individual features or task implementations.
   - Naming: `feature/EMS-[ticket_id]-description` or `feature/short-description` (e.g., `feature/auth-jwt-guard`).
4. **`bugfix/*`**: Bug fixes for issues found in the `develop` branch.
   - Naming: `bugfix/issue-description`
5. **`hotfix/*`**: Emergency bug fixes targeting the production (`main`) branch directly.
   - Naming: `hotfix/production-bug-description`

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: ...` for a new feature.
- `fix: ...` for a bug fix.
- `docs: ...` for documentation modifications.
- `style: ...` for formatting, missing semicolons, etc.
- `refactor: ...` for code changes that neither fix a bug nor add a feature.
- `test: ...` for adding or correcting tests.
- `chore: ...` for updates to build scripts, package managers, etc.

_Example_: `feat(auth): implement jwt refresh token rotation`

## Pull Request and Merge Process

1. Create a branch from `develop`.
2. Commit code adhering to linting and formatting criteria.
3. Push to origin and open a PR against `develop`.
4. Ensure the CI/CD pipeline tests and checks pass.
5. Merge using **Squash and Merge** to maintain a clean git history.
