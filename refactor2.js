const fs = require('fs');

const files = ['src/Synchronizer.ts', 'src/ResetManager.ts', 'src/TemplateHelper.ts'];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add imports if not exist
    if (!content.includes('import { DateManager }')) {
        content = content.replace(
            /(import \{.*\} from "\.\/TaskUtils";)/,
            '$1\nimport { DateManager } from "./DateManager";\nimport { FileManager } from "./FileManager";\nimport { REGEX, HEADERS } from "./Constants";'
        );
    }
    
    // Replace class fields
    content = content.replace(
        '    utils: TaskUtils;',
        '    utils: TaskUtils;\n    dateManager: DateManager;\n    fileManager: FileManager;'
    );
    
    // Replace constructor
    content = content.replace(
        'constructor(app: App, settings: PluginSettings, utils: TaskUtils) {',
        'constructor(app: App, settings: PluginSettings, utils: TaskUtils, dateManager: DateManager, fileManager: FileManager) {'
    );
    
    content = content.replace(
        'this.utils = utils;',
        'this.utils = utils;\n        this.dateManager = dateManager;\n        this.fileManager = fileManager;'
    );
    
    fs.writeFileSync(file, content);
    console.log(file + ' refactored.');
});
