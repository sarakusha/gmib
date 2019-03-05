#!/usr/bin/env node --no-warnings
"use strict";

const path = require('path');

require('@babel/register')({
  extensions: ['.ts', '.js']
});

const main = path.resolve(__dirname, './index.ts');

require(main);