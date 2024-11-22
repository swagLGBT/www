#!/usr/bin/env bash

set -euxo pipefail

# install age
go install filippo.io/age/cmd/...@latest

# confirm it's on PATH
which age

# run the build
npm run build
