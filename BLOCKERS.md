# Blockers

Each item is something only Zhiyuan can do.
Each item says what is missing, why it matters, and the exact steps.

## B1. Decide about two early commits before the repo goes public

**What.** Commit `c85b5fc` ("docs: record D1 to D12") has two lines that later commits removed:
- the recruiter's first name,
- one personal sentence.

Later commits removed both lines from the files.
They are still in the git history, and the unattended run may not rewrite history.

**Why it matters.** Anyone can read the full history of a public repo.

**Steps.** Pick one before the first push:
1. If both lines are fine to publish, do nothing.
2. If not, publish a new history with one commit:
   ```
   git checkout --orphan public
   git commit -m "initial public release"
   git branch -M public main
   ```
   The dense local history then stays only on this Mac.
