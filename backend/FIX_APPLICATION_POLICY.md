# Fix Application Policy

## ⚠️ IMPORTANT: Manual Approval Required

**All fixes require explicit manual approval and are NEVER applied automatically.**

## How Fixes Work

1. **AI Review Generates Suggestions**
   - When a PR is opened or updated, AI reviews the code
   - Issues are identified with suggested fixes
   - These are stored in the database with status `PENDING`

2. **User Reviews Suggestions**
   - User views issues in the dashboard
   - User can see suggested fixes for each issue
   - User can modify fixes before applying

3. **Manual Fix Application**
   - User must explicitly click "Apply Fix" for each issue
   - OR use bulk apply to apply multiple fixes at once
   - All fix applications require API calls: `POST /api/issues/:issueId/apply-fix`

4. **Fix PR Creation**
   - After applying fixes, user can create a fix PR
   - This also requires manual action: `POST /api/reviews/:reviewId/create-fix-pr`
   - User must manually merge the fix PR

## What Does NOT Happen Automatically

❌ **Fixes are NOT applied when:**
- PR is opened
- PR is updated
- PR is merged
- PR is closed
- Review is completed
- Any webhook event occurs

❌ **No auto-apply logic exists:**
- Webhook handlers do NOT apply fixes
- Review workers do NOT apply fixes
- No background jobs apply fixes automatically
- The `autoApply` config option is NOT implemented (even if set to `true`)

## Configuration

The YAML config has an `autoApply` option, but **it is currently NOT implemented**:

```yaml
fixes:
  autoApply: false  # Always false - not implemented
  requireApproval: true  # Always true - cannot be disabled
  createPR: true
```

Even if someone sets `autoApply: true` in their config, it will be ignored. All fixes require manual approval.

## API Endpoints

All fix application endpoints require explicit user action:

- `POST /api/issues/:issueId/apply-fix` - Apply single fix
- `POST /api/reviews/:reviewId/apply-bulk` - Apply multiple fixes
- `POST /api/reviews/:reviewId/create-fix-pr` - Create PR with fixes
- `POST /api/pull-requests/:prNumber/merge` - Merge fix PR (also manual)

## Security

This policy ensures:
- ✅ Users have full control over what gets applied
- ✅ No unexpected code changes
- ✅ All fixes are reviewed before application
- ✅ Audit trail of all fix applications

## Future Considerations

If auto-apply is ever implemented, it would:
1. Require explicit opt-in via configuration
2. Only apply fixes with high confidence scores
3. Only apply non-critical fixes
4. Still require user notification
5. Be clearly documented and warned about

**Current Status:** Auto-apply is NOT implemented and will NOT be implemented without explicit user request and thorough security review.
