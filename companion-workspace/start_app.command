#!/bin/zsh
set -eu

app_directory="${0:A:h}"
app_port="4174"
app_url="http://localhost:${app_port}/?v=86"
server_log="/tmp/quran-companion-server.log"

if ! lsof -nP -iTCP:"${app_port}" -sTCP:LISTEN >/dev/null 2>&1; then
  nohup python3 -m http.server "${app_port}" --bind 127.0.0.1 --directory "${app_directory}" >"${server_log}" 2>&1 &
  sleep 1
fi

open "${app_url}"
