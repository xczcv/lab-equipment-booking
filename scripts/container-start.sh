#!/bin/sh
set -eu

node dist/maintenance/migrate.js schema
exec node dist/main.js
