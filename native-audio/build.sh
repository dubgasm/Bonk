#!/bin/bash
set -e

cd "$(dirname "$0")"

# Determine platform and architecture
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$PLATFORM" in
  darwin)
    if [ "$ARCH" = "arm64" ]; then
      TARGET="aarch64-apple-darwin"
      OUTPUT="native-audio.darwin-arm64.node"
    else
      TARGET="x86_64-apple-darwin"
      OUTPUT="native-audio.darwin-x64.node"
    fi
    ;;
  linux)
    TARGET="x86_64-unknown-linux-gnu"
    OUTPUT="native-audio.linux-x64.node"
    ;;
  *)
    echo "Unsupported platform: $PLATFORM"
    exit 1
    ;;
esac

# Build for the target platform
echo "Building for $TARGET..."
cargo build --release --target "$TARGET"

# napi-rs outputs to target/{target}/release/lib{native_audio}.{ext}
# Find and copy the built library, renaming to .node extension
if [ -f "target/$TARGET/release/libnative_audio.dylib" ]; then
  cp "target/$TARGET/release/libnative_audio.dylib" "$OUTPUT"
elif [ -f "target/$TARGET/release/libnative_audio.so" ]; then
  cp "target/$TARGET/release/libnative_audio.so" "$OUTPUT"
elif [ -f "target/$TARGET/release/native_audio.dll" ]; then
  cp "target/$TARGET/release/native_audio.dll" "$OUTPUT"
elif [ -f "target/release/libnative_audio.dylib" ]; then
  # Fallback: check if built without target (local build)
  cp "target/release/libnative_audio.dylib" "$OUTPUT"
elif [ -f "target/release/libnative_audio.so" ]; then
  cp "target/release/libnative_audio.so" "$OUTPUT"
else
  echo "Failed to find built library"
  echo "Checked: target/$TARGET/release/ and target/release/"
  ls -la target/*/release/ 2>/dev/null || ls -la target/release/ 2>/dev/null || echo "No target directory found"
  exit 1
fi

echo "✓ Built: $OUTPUT"
