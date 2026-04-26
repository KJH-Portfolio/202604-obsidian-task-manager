
export interface MyWorldSettings {
    projectDir: string;
    schedulePath: string;
    archiveDir: string;
    fleetingMemoPath: string;
    autoSync: boolean;
}

export interface TaskData {
    checked: boolean;
    text: string;
    indent: string;
    deleted: boolean;
    id?: string;
}

export interface DailyNoteData {
    byId: Record<string, TaskData>;
    byText: Record<string, TaskData[]>;
    orderedTasks: { type: 'id' | 'text'; key: string }[];
}

export interface ProjectResult {
    sortPri: number;
    minDiff: number;
    noteName: string;
    calloutText: string;
}

export interface TableStats {
    sq: Record<string, number>;
    ar: Record<string, number>;
    cs: Record<string, Record<string, number>>;
    tableHeaders: string[];
}
