# Repository Instructions

## Running gmib

gmib checks configuration files for its activation signature during startup. Be careful when launching it from a sandbox or isolated environment: the app may not see the expected configs and
will behave as not activated. Do not treat a sandboxed launch as a valid activation or licensing
check unless the required config paths are explicitly available.

When you need to run Electron for manual verification, make sure it uses the real gmib user data
directory, or activation-gated features will be hidden. The local activation values are stored by
`electron-store` in `/Users/sarakusha/Library/Application Support/gmib/gmib-local.json` as the
`announce` and `iv` fields. Do not copy those values into the repository or logs; pass the existing
user data directory through to Electron instead, for example with
`--user-data-dir="/Users/sarakusha/Library/Application Support/gmib"` when using a launch command
that would otherwise isolate Electron from the normal app config.

## User Documentation

Keep `README.md` and the built-in help at `packages/renderer/gmib/components/Help/Help.mdx` up to date and synchronized when code changes add features, change existing behavior, or introduce details that matter to users or contributors. Add meaningful notes or comments there when they help explain the impact of the change.

Do not add development artifacts such as build scripts, test commands, packaging details, or contributor-only workflow notes to `Help.mdx`; keep those in `README.md` or contributor documentation.

## Commit Messages

Use Conventional Commits for all commit messages.

Examples:

- `fix: handle Electron dev launch environment`
- `chore: migrate pnpm settings to workspace config`
- `test: add preload coverage`

After each substantial and final change that should be committed separately, immediately suggest a commit message.

## Subagent Orchestration Policy

For non-trivial tasks, first create a short execution plan and split the work into independent or weakly-coupled subtasks.

The goal is to achieve a high-quality result while using model capacity and tokens efficiently. Do not assign strong and expensive models to work that a cheaper model can reliably complete, but do not optimize for cost when doing so materially increases the risk of errors, rework, regressions, or poor architectural decisions.

### 1. Classify each subtask by complexity and risk

Before assigning a subagent, evaluate both:

- implementation complexity;
- cost of being wrong.

A small code change may still be high-risk.

#### Simple / low-risk

Examples:

- locating code or configuration;
- mechanical edits;
- formatting;
- documentation;
- adding straightforward tests that follow an existing pattern;
- inspecting logs using clear criteria;
- small isolated changes with no architectural decisions.

Assign these tasks to the cheapest/fastest model that can reliably complete them.

#### Medium complexity

Examples:

- implementing a normal feature;
- modifying several related files;
- fixing a bug with a reasonably well-understood cause;
- writing a non-trivial test suite;
- local refactoring;
- analyzing a bounded subsystem.

Use a mid-tier model.

#### Complex or high-risk

Examples:

- architecture and design decisions;
- concurrency, races, IPC, lifecycle, process management;
- difficult bugs with an unknown root cause;
- changes spanning multiple subsystems;
- security or data-integrity-sensitive changes;
- unusual algorithms;
- critical code review;
- changes where an incorrect implementation would cause significant rework.

Use a strong model or keep this work with the primary agent.

### 2. Do not optimize cost at the expense of quality

Token savings are a constraint, not the main objective.

If a subtask requires broad context, careful reasoning, architectural judgment, or a high confidence level, use a sufficiently capable model from the beginning.

Do not over-fragment work into tiny subtasks when coordination, context transfer, and review would cost more than having one stronger agent complete the work directly.

Prefer:

**the cheapest model that is likely to complete the subtask correctly on the first attempt.**

If the cost of failure is high, increase model capability.

### 3. Give subagents focused context

Provide each subagent only the context required for its task.

A subagent assignment should clearly state:

- the objective;
- the scope and boundaries;
- important constraints;
- relevant files or subsystems;
- acceptance criteria;
- required tests or validation;
- whether the subagent may create a commit.

Do not make a subagent rediscover the entire project when the primary agent already knows the relevant context.

### 4. Require concise result reports

Each subagent should return a concise report containing:

- what it found;
- what it changed;
- which files were modified;
- which tests or checks were run;
- remaining uncertainties or risks;
- commit hash, if a commit was created.

Avoid long summaries of obvious implementation details.

### 5. Commits

A subagent may create a commit when its work is:

- logically complete;
- sufficiently isolated;
- validated by the appropriate checks.

Use conventional commits when the repository follows that convention.

Do not combine unrelated work from separate subtasks into one commit.

Experimental work or work that still requires primary-agent review does not need to be committed immediately.

### 6. The primary agent owns the final result

The primary agent remains responsible for the complete solution.

After subagents finish, the primary agent must review the actual work rather than trusting reports alone.

At minimum, review:

- diffs;
- compatibility between changes;
- architectural assumptions;
- error handling and edge cases;
- relevant tests;
- type checks;
- linting;
- build or integration checks where appropriate.

A subagent report is not proof that the implementation is correct.

### 7. Use an iterative correction loop

If review finds a problem:

1. describe the issue precisely;
2. preferably return it to the same subagent that implemented that part;
3. use the least expensive model that is sufficient to correct it;
4. review the correction again.

Use the loop:

**implement → review → fix → verify**

Repeat until the acceptance criteria are satisfied.

Do not create endless refinement loops for cosmetic issues once the task is correct and complete.

### 8. Independent review

For complex or high-risk changes, consider assigning a separate reviewer.

The reviewer should actively look for:

- real bugs;
- race conditions;
- lifecycle problems;
- IPC/process-management issues;
- unhandled edge cases;
- broken contracts or assumptions;
- regressions;
- insufficient tests.

Do not spend a strong review model on trivial changes without a concrete reason.

### 9. Parallelism

Run subtasks in parallel only when they are genuinely independent.

Avoid having multiple agents modify the same files concurrently unless there is a strong reason.

If one task depends on the design or result of another, resolve that dependency first.

Parallelism should reduce total work, not increase merge and review overhead.

### 10. Escalation

If a cheaper subagent:

- fails repeatedly;
- misunderstands the task;
- produces low-confidence results;
- requires substantial correction;
- encounters unexpected architectural complexity;

escalate the task to a stronger model instead of repeatedly spending tokens on unsuccessful retries.

Similarly, downgrade follow-up work to cheaper models when the difficult reasoning has already been completed and only mechanical changes remain.

### 11. Final verification

Before considering the overall task complete, the primary agent should verify the repository or system as a whole.

Use the checks appropriate to the project, such as:

- targeted tests;
- broader test suites;
- typecheck;
- lint;
- build;
- integration tests;
- runtime checks;
- inspection of logs or generated output.

Do not declare success merely because each isolated subtask passed its own local checks.

### 12. Final user-facing report

When the task is complete, provide a concise summary of:

- what was changed;
- important design decisions;
- tests and validation performed;
- commits created;
- known limitations or remaining risks.

Do not expose unnecessary internal orchestration details unless they are useful to the user.

## Core Principle

Choose model capability based on both **task complexity** and **cost of failure**.

Use cheaper models aggressively for bounded, low-risk work.

Use stronger models when reasoning quality matters more than token savings.

The primary agent is responsible for orchestration, review, integration, and final correctness.
