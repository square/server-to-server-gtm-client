# Contributing

## Sign the CLA

All contributors to your PR must sign our [Individual Contributor License Agreement (CLA)](https://spreadsheets.google.com/spreadsheet/viewform?formkey=dDViT2xzUHAwRkI3X3k5Z0lQM091OGc6MQ&ndplr=1). The CLA is a short form that ensures that you are eligible to contribute.

## Style Guide
The `code.js` file follows the [Square JavaScript style guide](https://github.com/square/eslint-plugin-square). 

 
### Linting
```bash
yarn install

yarn lint
```

`yarn lint-fix` is not recommended as there are some [Sandboxed JavaScript](https://developers.google.com/tag-manager/templates/sandboxed-javascript) linting rules from the sGTM text editor that clash with Square's rules. If necessary, add lint ignore statements in `code.js`


## Making changes
1. Read Google Tag Manager's guidance for [updating templates](https://developers.google.com/tag-manager/templates/gallery#build_your_template).
2. Upload the `template.tpl` file to your Server-Side GTM container.
3. Make changes to the template. Ensure your template tests are still passing. Add new tests if applicable.
4. For code changes, copy these changes to `code.js` and ensure they meet the style guide. This file's only purpose is to make code reviews easier. It will not impact the behavior of the template. Changes to tests do not need to be copied to separate JavaScript files.
5. Export the template and replace `template.tpl` in this repository.
6. Open a pull request. Include any test plans and screenshots that are relevant to your changes.
  

## Guidance

### One issue or bug per Pull Request

Keep your Pull Requests small. Small PRs are easier to reason about which makes them significantly more likely to get merged.

### Issues before features

If you want to add a feature, please file an [Issue](../../issues) first. An Issue gives us the opportunity to discuss the requirements and implications of a feature with you before you start writing code.


### Backwards compatibility

Respect the minimum deployment target. If you are adding code that uses new APIs, make sure to prevent older clients from crashing or misbehaving. Our CI runs against our minimum deployment targets, so you will not get a green build unless your code is backwards compatible. 

### Forwards compatibility

Please do not write new code using deprecated APIs.