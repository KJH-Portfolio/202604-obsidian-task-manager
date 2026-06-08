const fs = require('fs');
let t = fs.readFileSync('src/TaskUtils.ts', 'utf8');

// 1. imports 추가
t = t.replace(
    'import { App, TFile, moment } from "obsidian";',
    'import { App, TFile, moment } from "obsidian";\nimport { REGEX, MARKER_PRI, EMOJI_MAP, HEADERS } from "./Constants";\nimport { DateManager } from "./DateManager";\nimport { FileManager } from "./FileManager";'
);

// 2. Constants 제거
t = t.replace(/export const REGEX = \{[\s\S]*?export const EMOJI_MAP: Record<string, string> = \{[\s\S]*?\n\};\n\n/m, '');

// 3. 필드 추가
t = t.replace(
    '    app: App;\n    settings: PluginSettings;',
    '    app: App;\n    settings: PluginSettings;\n    dateManager: DateManager;\n    fileManager: FileManager;'
);

// 4. constructor 수정
t = t.replace(
    'constructor(app: App, settings: PluginSettings) {',
    'constructor(app: App, settings: PluginSettings, dateManager: DateManager, fileManager: FileManager) {'
);
t = t.replace(
    'this.settings = settings;',
    'this.settings = settings;\n        this.dateManager = dateManager;\n        this.fileManager = fileManager;'
);

// 5. getAdjustedNow() 제거
t = t.replace(/    getAdjustedNow\(\): moment\.Moment \{[\s\S]*?return now;\n    \}\n/m, '');

fs.writeFileSync('src/TaskUtils.ts', t);
console.log("TaskUtils.ts refactored.");
