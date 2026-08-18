# Security Policy

`dsh-smart-profile` is designed to inspect project metadata, not secrets.

Version 0.1.x reads only known project manifests such as `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, Maven/Gradle manifests, plus selected filenames/directories used as stack signals. It does not read `.env` files or arbitrary source files.

The plugin does not automatically install third-party Harness plugins. Recommendations are capability categories and search terms only.

If you discover a path traversal, unintended secret read, unsafe installation behavior, or package supply-chain issue, please report it privately to the repository maintainer before public disclosure.
