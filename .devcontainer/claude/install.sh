#!/bin/bash
set -euxo pipefail

npm install -g @anthropic-ai/claude-code

# could do `claude install` now to install the self-updating binary
# but this script is running as 'root' at the moment so this wouldn't have the desired effect, i.e. it won't work for the 'node' user
# so to update claude code just rebuild the devcontainer and it will install the latest globally / for all users again
