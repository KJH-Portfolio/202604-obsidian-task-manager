const fs = require('fs');

let content = fs.readFileSync('src/main.ts', 'utf8');

// Add imports
content = content.replace(
    'import { TemplateHelper } from "./TemplateHelper";',
    'import { TemplateHelper } from "./TemplateHelper";\nimport { DateManager } from "./DateManager";\nimport { FileManager } from "./FileManager";'
);

// Add fields
content = content.replace(
    '    settings: PluginSettings;',
    '    settings: PluginSettings;\n    dateManager: DateManager;\n    fileManager: FileManager;'
);

// Update instantiations
content = content.replace(
    /        this\.utils = new TaskUtils\(this\.app, this\.settings\);\n        this\.synchronizer = new Synchronizer\(this\.app, this\.settings, this\.utils\);\n        this\.resetManager = new ResetManager\(this\.app, this\.settings, this\.utils\);\n        this\.templateHelper = new TemplateHelper\(this\.app, this\.settings, this\.utils\);/,
    '        this.dateManager = new DateManager(this.settings);\n        this.fileManager = new FileManager(this.app);\n        this.utils = new TaskUtils(this.app, this.settings, this.dateManager, this.fileManager);\n        this.synchronizer = new Synchronizer(this.app, this.settings, this.utils, this.dateManager, this.fileManager);\n        this.resetManager = new ResetManager(this.app, this.settings, this.utils, this.dateManager, this.fileManager);\n        this.templateHelper = new TemplateHelper(this.app, this.settings, this.utils, this.dateManager, this.fileManager);'
);

fs.writeFileSync('src/main.ts', content);
console.log('src/main.ts refactored.');
