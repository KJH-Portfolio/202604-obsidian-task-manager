export interface TaskData {
    status: string;
    checked: boolean;
    text: string;
    indent: string;
    deleted: boolean;
    id?: string;
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

export interface DailyMeta {
    step: string;
    review: string;
}

import { moment } from "obsidian";

declare global {
    interface Window {
        moment: typeof moment;
    }
}
