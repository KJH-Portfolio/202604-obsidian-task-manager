const fs = require('fs');

const files = ['src/main.ts', 'src/TaskUtils.ts', 'src/Synchronizer.ts', 'src/ResetManager.ts', 'src/TemplateHelper.ts'];

files.forEach(f => {
    let t = fs.readFileSync(f, 'utf8');
    t = t.replace(/const file = this\.app\.vault\.getAbstractFileByPath\(([^)]+)\);/g, 'const file = this.fileManager.getFile($1);');
    t = t.replace(/if \(file instanceof TFile\) \{/g, 'if (file) {');
    
    // Some other patterns
    t = t.replace(/const mainFile = this\.app\.vault\.getAbstractFileByPath\(([^)]+)\);/g, 'const mainFile = this.fileManager.getFile($1);');
    t = t.replace(/if \(mainFile instanceof TFile\) \{/g, 'if (mainFile) {');
    
    t = t.replace(/const abstractFile = this\.app\.vault\.getAbstractFileByPath\(([^)]+)\);/g, 'const abstractFile = this.fileManager.getFile($1);');
    t = t.replace(/if \(abstractFile instanceof TFile\) \{/g, 'if (abstractFile) {');

    fs.writeFileSync(f, t);
    console.log(f + ' updated for getFile.');
});
