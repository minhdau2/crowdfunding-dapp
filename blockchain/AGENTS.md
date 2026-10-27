# Solidity workspace for Remix Desktop

- Open this directory directly in Remix Desktop.
- Put production Solidity sources in `contracts/`.
- Use the Remix Solidity Unit Testing plugin for tests in `tests/`; test file names end with `_test.sol` and can import `remix_tests.sol` as provided by Remix.
- This directory has no npm project or CLI test runner. Do not install a blockchain framework unless the user requests it.
- Record the Solidity compiler version, EVM target and optimizer settings in `README.md` whenever a real contract is added.
- Keep contract ABI exports and deployment records consistent with the deployed source. Never fabricate a deployed address, transaction hash or passing test result.
- Use Remix VM to exercise contracts in isolation. For an external frontend, use a network accessible to its wallet/provider; do not assume the IDE simulation exposes an RPC endpoint.
- Preserve `totalRaised` history independently from outstanding contributions and enforce campaign isolation, deadlines, authorization and safe ETH transfers when the crowdfunding implementation is added.
- Never put private keys or recovery phrases in source, deployment records or client environment variables.

Official references:
- https://remix-ide.readthedocs.io/en/latest/desktop.html
- https://remix-ide.readthedocs.io/en/latest/run.html
- https://remix-ide.readthedocs.io/en/latest/unittesting.html
