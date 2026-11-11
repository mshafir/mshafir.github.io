#!/usr/bin/env bash
# Prints --no-sandbox when Electron's Chromium sandbox can't start on this machine (Ubuntu 23.10+
# restricts unprivileged user namespaces, and the setuid helper isn't set up). The app only loads
# its own local files, so this is low risk, but the one-time fix below keeps the sandbox on.
helper="node_modules/electron/dist/chrome-sandbox"
[ "$(uname)" = "Linux" ] || exit 0
[ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || exit 0
if [ -f "$helper" ] && [ "$(stat -c '%u' "$helper")" = "0" ] && [ -u "$helper" ]; then exit 0; fi
echo "Note: starting without Chromium's sandbox. To keep it on, run once:" >&2
echo "  sudo chown root:root editor/$helper && sudo chmod 4755 editor/$helper" >&2
echo "--no-sandbox"
