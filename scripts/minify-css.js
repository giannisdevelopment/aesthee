#!/usr/bin/env node
/**
 * Minify css/styles.css → css/styles.min.css (no deps).
 * Strips comments and collapses whitespace; safe for this stylesheet.
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "css", "styles.css");
const dest = path.join(__dirname, "..", "css", "styles.min.css");

let css = fs.readFileSync(src, "utf8");

// Remove /* … */ comments (non-greedy, multiline)
css = css.replace(/\/\*[\s\S]*?\*\//g, "");
// Collapse runs of whitespace to a single space
css = css.replace(/\s+/g, " ");
// Drop spaces around common punctuation
css = css.replace(/\s*([{}:;,>~+])\s*/g, "$1");
// Keep space after "and"/"or" in @media — already collapsed fine
// Tidy empty rules / double semis
css = css.replace(/;}/g, "}");
css = css.replace(/^\s+|\s+$/g, "");

fs.writeFileSync(dest, css);
const before = fs.statSync(src).size;
const after = fs.statSync(dest).size;
console.log(
  `Minified styles.css ${(before / 1024).toFixed(1)} KiB → ${(after / 1024).toFixed(1)} KiB (−${(
    ((before - after) / before) *
    100
  ).toFixed(0)}%)`
);
