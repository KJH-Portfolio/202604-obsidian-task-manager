const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/border: 1px solid rgba\(\);/g, (match, offset, str) => { 
    const colors = { 
        '0': '233, 49, 71, 0.8', 
        '1': '255, 210, 0, 0.8', 
        '2': '68, 207, 110, 0.8', 
        '3': '8, 109, 221, 0.8', 
        '7': '150, 150, 150, 0.8', 
        '!': '140, 0, 40, 0.9' 
    }; 
    const context = str.substring(Math.max(0, offset - 120), offset); 
    for (let k in colors) { 
        if (context.includes('data-task="' + k + '"')) {
            return 'border: 1px solid rgba(' + colors[k] + ')'; 
        }
    } 
    return match; 
}); 

fs.writeFileSync('styles.css', css, 'utf8');
console.log('Colors successfully fixed');
