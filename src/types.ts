
export interface DailyMeta {
    step: string;
    review: string;
}

export interface RoutineCategory {
    id: string;
    name: string;
    items: string[];
}

export interface RoutineStructure {
    affirmation?: string;
    categories: RoutineCategory[];
}

export interface RoutineDiff {
    renamedCategories: Record<string, string>; // { oldName: newName }
    removedCategories: string[];
    addedCategories: string[];
}

import { moment } from "obsidian";

declare global {
    interface Window {
        moment: typeof moment;
    }
}

