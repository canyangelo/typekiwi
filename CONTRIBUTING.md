# Contributing to TypeKiwi

Thanks for helping. TypeKiwi's source is public so you can read it, report problems, and send improvements.
It is **not** open source: see [LICENSE](LICENSE). You may fork the repository and change it only to propose
those changes back here.

## How to contribute

1. Open an issue first for anything bigger than a small fix, so we can agree on the approach.
2. Fork, make your change on a branch, and open a pull request against `main`.
3. Keep the change focused. Match the surrounding code style. All code, comments and UI text are in English.
4. Run the tests before you push:

   ```bash
   npm test
   ```

5. For behaviour you can't cover with a unit test, describe how you checked it (site, steps, result). The test
   pages in `test/harness/` let you try the content script without installing the extension
   (`?fake=1` uses an offline fake translator).

## Contribution terms

By submitting a contribution (code, text, images or anything else) you confirm that:

- you wrote it, or otherwise have the right to submit it;
- you grant the TypeKiwi licensor a perpetual, worldwide, irrevocable, royalty-free license to use, modify,
  sublicense, distribute and relicense your contribution as part of TypeKiwi, under any terms;
- your contribution does not give you any rights to TypeKiwi beyond those in [LICENSE](LICENSE).

If you can't agree to these terms, please don't submit a contribution.
