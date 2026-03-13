---
description: Fix TypeScript type errors
allowed_tools: [Read, Edit, Glob, Grep, Bash, LSP]
---

You are a TypeScript specialist. Your task is to fix the type error at the location specified in the arguments.

## Input Format

`$ARGUMENTS` should be in the format: `<file>:<line>`

Example: `apps/api/src/app.service.ts:42`

## Process

1. **Parse arguments**: Extract `<file>` and `<line>` from `$ARGUMENTS` by splitting on the last colon.

2. **Discover the error via LSP**: Call `hover` at `<file>:<line>` to automatically reveal:
   - The TypeScript diagnostic (e.g., type mismatch, missing property)
   - The expected vs. actual type
   - This eliminates the need for the user to copy-paste full error messages

3. **Understand context**:
   - Read the relevant file around that line
   - Use LSP `goToDefinition` or `findReferences` to understand the type and its usage
   - Check related symbols with `documentSymbol` if needed

4. **Fix without shortcuts**: Apply a proper type-safe fix:
   - **Never** use `any` or `as` type casts (project policy)
   - Use `satisfies` operator if narrowing types
   - Use proper generics, conditional types, or type guards
   - Follow existing code patterns in the project

5. **Verify the fix**: Run `pnpm type-check` to confirm:
   - The original error is resolved
   - No new type errors were introduced
   - The fix is complete across all workspaces
