## Linux build dependencies (Cursor setup)

Install these packages so Rust + Node native builds work cleanly:

- **gcc / g++** — compilers for any C/C++ parts pulled in by Rust crates or Node native modules  
- **make** — runs native build steps during installs/compilation  
- **pkg-config** — helps the build system find installed libraries and the right compile/link flags  
- **lld** — faster linker; speeds up Rust builds noticeably  
- **libasound2-dev** — ALSA headers required for audio output on Linux (important for Rust audio)  
- **libssl-dev** — OpenSSL headers used by networking/crypto dependencies  
- **libwebkit2gtk-4.1-dev** — WebKitGTK dev libs needed for Linux desktop/webview integration  
- **autogen** — generates configure scripts for some native dependencies  
- **curl / wget** — download tools commonly used by install scripts  
- **git** — fetches source code and git-based dependencies
