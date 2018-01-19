#!/usr/bin/env node
/**
 * Created by sharad on 9/24/17.
 */

const DependencyScanner = require('../lib/DependencyScanner');

var ds = new DependencyScanner();
ds.scanv3(null);