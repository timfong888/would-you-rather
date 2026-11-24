# EAS Workflow trial (issue #199)

`ios-simulator-smoke.yml` runs the same Maestro flows as `.github/workflows/ios-simulator-smoke.yml` on Expo infrastructure.
Manual only: `eas workflow:run .eas/workflows/ios-simulator-smoke.yml --non-interactive`. Install `eas-cli` globally first;
`npx eas-cli@latest` stalls intermittently behind the sandbox proxy.

Status: the build succeeds (6-7 min), but Maestro does not see the app's home controls ("Grown-ups", "With kids") on the
EAS-built binary, on iOS 26.5 (Xcode 26.2 image) and iOS 18.6 (Xcode 16.4 image). The same flows pass on a GitHub macOS runner.
Not resolved; see the comparison on #199. Do not merge as a CI check until it passes.
