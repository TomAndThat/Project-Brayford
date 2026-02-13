# Image API Integration Tests

## Running Tests

From the project root:

```bash
# Run all tests including these integration tests
pnpm test

# Run only image API tests
pnpm test apps/creator/app/api/images

# Run with coverage
pnpm test --coverage
```

## Test Files

### `cascade-deletion.integration.test.ts`

Integration tests for the hybrid cascade deletion feature. Tests cover:

1. **Standard Deletion (No Force)**
   - Conflict response when image is in use
   - Live event warnings in response
   - Successful deletion when not in use

2. **Force Deletion (Cascade)**
   - Permission verification for brands and scenes
   - Brand image reference cleanup
   - Scene module config reference cleanup
   - Success summary responses

3. **Edge Cases**
   - Missing images
   - Deleted brand references
   - Empty cascade scenarios

All tests use mocked Firebase Admin SDK to avoid requiring emulator setup.

## Test Coverage Goals

- **Packages**: 70%+ line/function/branch/statement coverage
- **Apps**: 50%+ coverage (as per project standards)

These integration tests contribute to the overall API route coverage for the creator app.
