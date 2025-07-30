---
applyTo: '**'
---

# Formatting and indentention of files

DO NOT fix code indentation or formatting as part of work done by Copilot.  
Other tools will handle that.

# JSDoc comments

- Describe what the function does
- List all paramters, including (if possible) what properties object parameters have
- List possible return values, including Primises and data types. Insert empty line between parameters and return value descriptions.

# Unit tests

- Verify tests work after creation new test files.
- Do not fix linting or formatting issues in tests. These will be handled later using other tools.
- Run tests using "npm run test".
