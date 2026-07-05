const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// Replace inset shadow with 1px border
css = css.replace(/border: 1px solid transparent; box-shadow: inset 0 0 0 2px (rgba\([^)]+\));/g, 'border: 1px solid $1; box-shadow: none;');

fs.writeFileSync('styles.css', css, 'utf8');
console.log('CSS Border Fixed');
