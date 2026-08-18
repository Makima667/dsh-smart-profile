# Contributing

Issues and pull requests are welcome.

For the 0.x line, keep contributions focused on deterministic project detection, explainable recommendations, safe plugin installation, and compatibility with current DeepSeek Harness plugin contracts.

Before opening a pull request:

```bash
npm test
npm run pack:check
```

Please add tests for every new detector or recommendation rule. Avoid reading `.env`, credentials, private keys, arbitrary source code, or lockfiles unless a future feature explicitly requires it and has an opt-in privacy design.
