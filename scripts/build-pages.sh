#!/usr/bin/env bash

set -euo pipefail

RAGE_VERSION="0.11.0"

# Install rage

TEMP_DEB="$(mktemp)"
echo "Downloading \`rage\` from GitHub to $TEMP_DEB"

wget -O "$TEMP_DEB" "https://github.com/str4d/rage/releases/download/v$RAGE_VERSION/rage_$RAGE_VERSION-1_amd64.deb"

echo "Installing \`rage\`"
sudo dpkg -x "$TEMP_DEB" "$HOME"/.local/share

echo "Cleaning up $TEMP_DEB"
rm -f "$TEMP_DEB"

npm run build
