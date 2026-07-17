
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
