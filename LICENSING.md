# Third-Party Licensing Notice

## LGPL-3.0-or-later Dependencies via `sharp` / `libvips`

This project uses [`sharp`](https://sharp.pixelplumbing.com/) for server-side image generation
(via `@vercel/og`). `sharp` bundles pre-built native binaries of
[libvips](https://www.libvips.org/) through the `@img/sharp-libvips-*` platform packages,
which are licensed under **LGPL-3.0-or-later**.

### Why LGPL compliance is satisfied (Option A — Dynamic Linking)

The `@img/sharp-libvips-*` packages are **dynamically linked** prebuilt binaries. The Node.js
process loads the shared library at runtime and communicates with it through `sharp`'s
published JavaScript/N-API interface. The application source code (JavaScript/TypeScript) is
not statically compiled against or incorporated into libvips.

This usage pattern — calling a dynamically linked LGPL library through its public API — is
explicitly permitted by the LGPL-3.0 license (section 4), which allows proprietary
applications to use LGPL-licensed works provided:

1. The LGPL library is used as a separate, dynamically linked component.
2. Users are able to replace the library with a modified version (the `@img/sharp-libvips-*`
   packages can be swapped out independently via npm).
3. The license text for the LGPL components is made available (see below).

### License texts

- libvips / `@img/sharp-libvips-*`: [LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.html)
- `@img/sharp-wasm32`, `@img/sharp-win32-*`: Apache-2.0 AND LGPL-3.0-or-later AND MIT

The full LGPL-3.0 license text is available at:
https://www.gnu.org/licenses/lgpl-3.0.txt

### CVE remediation

`sharp` has been pinned to **≥ 0.35.3** (bundling libvips 8.18.3), which resolves:

- CVE-2026-33327 (High)
- CVE-2026-33328 (High)
- CVE-2026-35590
- CVE-2026-35591

Advisory: [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
