#!/bin/bash

jsx app/  build/

for f in main.js tag.js user.js; do
    browserify -d build/$f -o build/static/js/$f
    minify  build/static/js/$f --output app/static/js/$f
done

