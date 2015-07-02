#!/bin/bash

jsx app/ app/static/build/

for f in main.js tag.js; do
    browserify -d app/static/build/$f -o app/static/js/$f
done
