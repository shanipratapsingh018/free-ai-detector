# Measuring the detector

Put plain-text files in the two folders, one passage per file:

- `eval/human/` — passages you know were written by people (your own older writing, published work from before 2022).
- `eval/ai/` — passages you generated with a chatbot and did not edit.

Then run:

```sh
npm run evaluate
```

It prints how often each group is classified correctly and the false-positive rate (human text scored as AI-like).
Use at least 100 passages per folder, of 150 words or more, across the kinds of writing your visitors check
(essays, abstracts, emails, non-native English). Only publish accuracy figures that this script actually produced.
The text files are ignored by git, so private writing is not committed by accident.
