#!/bin/bash

if [ ! -d "node_modules" ]; then
    npm install --ignore-scripts
    npx next build
fi

npx next start