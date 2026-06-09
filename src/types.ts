
export interface MyWorldSettings {
    projectDir: string;
    schedulePath: string;
    archiveDir: string;
    fleetingMemoPath: string;
    autoSync: boolean;
}

export interface TaskData {
    status: string;
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
    planTasksDone: number;
    planTasksTotal: number;
    execTasks: string[];
}

export interface ProjectOverrideData {
    execTasks: string[];
    planTasksDone: number;
    planTasksTotal: number;
}

export interface TableStats {
    sq: Record<string, number>;
    ar: Record<string, number>;
    cs: Record<string, Record<string, number>>;
    tableHeaders: string[];
}

export interface SyncTask {
    id: string;
    line: string;
    status?: string;
}

export interface OrderedTask {
    type: "id" | "text";
    key: string;
}

export interface DailyData {
    orderedTasks: OrderedTask[];
    byId: Record<string, TaskData>;
    byText: Record<string, TaskData[]>;
}

export interface TaskItem {
    id: string | null;
    status: string;
    text: string;
    line: string;
    checked: boolean;
    indent?: string;
    anchorId?: string;
    task?: string;
    deleted?: boolean;
}

export interface DailyMeta {
    step: string;
    review: string;
}

export interface FullProjectResult {
    file: import("obsidian").TFile;
    done: number;
    total: number;
    dDayStr: string | null;
    pastStr: string | null;
    isTodayPast: boolean;
    todayDone: number;
    todayTotal: number;
    tasks: string[];
}

import { moment } from "obsidian";

declare global {
    interface Window {
        moment: typeof moment;
    }
}
