#!/bin/sh
cd "$(dirname "$0")" || exit 1
PHP_BIN="${PHP_BIN:-$(command -v php)}"
if [ -z "$PHP_BIN" ] && [ -x ./bin/php ]; then
  PHP_BIN="./bin/php"
fi
if [ -z "$PHP_BIN" ] && [ -x ../../work/php-8.4.14/sapi/cli/php ]; then
  PHP_BIN="../../work/php-8.4.14/sapi/cli/php"
fi
if [ -z "$PHP_BIN" ]; then
  echo 'Install PHP 8.1+ or set PHP_BIN to your PHP executable.'
  exit 1
fi
printf '\nMars Maps: http://127.0.0.1:8080\nPress Control-C to stop.\n\n'
exec "$PHP_BIN" -S 127.0.0.1:8080 -t public
