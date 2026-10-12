# Contributing to HuStdLookupSdk

Thanks for helping improve this SDK. The project is maintained by [East Devs Community](https://github.com/east-devs-community).

`HuStdLookupSdk` is a zero-dependency Node.js library. It looks up Haramaya University student and dorm records from the built-in dataset in `src/data.json`.

## What you need

- [Node.js](https://nodejs.org/) 18 or newer
- Git

There are no packages to install. The SDK and its tests use only the Node.js standard library.

## Set up

```bash
git clone https://github.com/east-devs-community/HuStudentLookupSdk.git
cd HuStudentLookupSdk
npm test
```

`npm test` runs `node --test sdk.test.js`. The same command runs before npm publish.

## Where things live

```text
.
├── sdk.test.js            # Tests (node:test)
├── src/HuStdLookupSdk.js  # Lookup and search implementation
├── src/data.json          # Built-in student dataset
├── src/index.js           # Package entry (CommonJS)
└── src/index.d.ts         # TypeScript types
```

## Making a change

1. Fork the repository and create a branch from `main`:

   ```bash
   git checkout -b feature/short-description
   ```

2. Keep the public behavior stable unless the change is intentionally a breaking one. `DormSDK` is a legacy alias of `HuStdLookupSdk` and should keep working.

3. If you add or change a public method, option, or record field, update `src/index.d.ts` in the same change.

4. Add or update a test in `sdk.test.js` for the behavior you changed. Tests should use the built-in dataset and `node:assert`.

5. Run the tests before you open a pull request:

   ```bash
   npm test
   ```

6. Match the style already in the file you edit: CommonJS, `'use strict'`, and small focused functions.

### Student data

`src/data.json` holds real student and dorm records. Change it only when a record is wrong or incomplete, and keep the existing field names (`id`, `name`, `sex`, `dept`, `campus`, `building`, `dorm`, `year`). Do not add extra personal details.

## Pull requests

Open a pull request against `main` and describe:

- What changed and why
- How you tested it (`npm test`, plus any manual check)

Keep the pull request focused on one change. The project is licensed under the [MIT License](LICENSE). Contributions are accepted under that same license.

## Reporting a problem

Open an issue and include:

- What you expected and what happened
- A short code sample, if the problem is in the API
- Your Node.js version (`node -v`)
