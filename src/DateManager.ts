/* eslint-disable @typescript-eslint/no-unsafe-assignment -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-call -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unsafe-return -- External API and dynamic data parsing requires flexible typing */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Complex type casting needed for markdown AST */
import { moment } from "obsidian";
import { PluginSettings } from "./settings";
import { DATE_FORMATS } from "./Constants";

export class DateManager {
    private settings: PluginSettings;

    constructor(settings: PluginSettings) {
        this.settings = settings;
    }

    /**
     * midnightOffsetHour를 반영한 현재 시간(moment 객체) 반환
     */
    getAdjustedNow(): moment.Moment {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Type inference limitation
        const now = (window as any).moment();
        const offset = this.settings.midnightOffsetHour ?? 4;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        if (now.hour() < offset) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Type inference limitation
            return now.subtract(1, 'days');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Type inference limitation
        return now;
    }

    getTodayStart(): Date {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Obsidian moment API usage
        return this.getAdjustedNow().clone().startOf('day').toDate();
    }

    formatDate(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format(DATE_FORMATS.DATE_ONLY);
    }

    formatTime(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format(DATE_FORMATS.TIME_ONLY);
    }

    formatDateTime(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format(DATE_FORMATS.DATE_TIME);
    }

    // Archive Date Formats
    getYear(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format(DATE_FORMATS.ARCHIVE_YEAR);
    }
    
    getQuarter(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return `Q${dateMoment.quarter()}`;
    }

    getMonth(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format("MM");
    }

    getYearMonth(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format(DATE_FORMATS.ARCHIVE_MONTH);
    }

    getWeek(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format(DATE_FORMATS.ARCHIVE_WEEK);
    }
    
    getYearWeek(dateMoment: moment.Moment): string {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Type inference limitation
        return dateMoment.format("gggg");
    }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-member-access -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-call -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-argument -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unsafe-return -- Re-enable strict rules */
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion -- Re-enable strict rules */
