#!/bin/bash
echo 'Starting Woodchipper on directory: ' $1
find $1 -name '*.ts*' | xargs -n 10 npx eslint --fix --no-error-on-unmatched-pattern
