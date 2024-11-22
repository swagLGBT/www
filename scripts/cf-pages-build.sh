#!/usr/bin/env bash

set -euxo pipefail

go install filippo.io/age/cmd/...@latest

which age

npm run build
