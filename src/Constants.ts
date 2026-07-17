export const REGEX = {
    EXTRACT_ID: /^(.*?)(?:\s*\^([a-zA-Z0-9]+))?$/,
    TASK_LINE: /^(\s*[-*+])\s+\[(.)\]\s+(.*)$/,
    MATCH_TASK: /^\s*[-*+]\s+\[.\]/,
    MATCH_TASK_COMPLETED: /^[\s]*[-*+]\s+\[[xX-]\]/,
    STATUS_MATCH: /^[\s]*[-*+]\s+\[(.)\]/,
    DATE_LABEL: /📅\s*\d{4}-\d{2}-\d{2}/,
    HEADING_START: /^#+\s+/,
    TOP_HEADING_START: /^#\s+/,
    EXEC_HEADER: /^#\s+(실행|Execution)$/m,

    NOTE_LINK: /^##\s+(.+)$/,
    SUMMARY_MATCH: /^[\s]*[-*+]\s+\[([xX ])\]/,
    MARKER_REPLACE_2: /(\[[^\]]\])\s*/,

    TODO_HEADER: /(?:^|\n)#\s+Todo(?=\n|$)/i,
    INDENT: /^\s*/
};

export const MARKER_PRI: Record<string, number> = {
    '!': 1,
    '0': 2,
    '1': 3,
    '2': 4,
    '3': 5,
    '7': 6,
    '': 99
};

export const EMOJI_MAP: Record<string, string> = {
    "1": "🟦",
    "2": "🟩",
    "3": "🟨",
    "4": "🟥"
};

export const HEADERS = {
    TODO: "# Todo",

    STATS: "# 통계",

    CHECKLIST: "# 체크리스트"
};

export const DATE_FORMATS = {
    DATE_ONLY: "YYYY-MM-DD",
    TIME_ONLY: "HH:mm",
    DATE_TIME: "YYYY-MM-DDTHH:mm",
    ARCHIVE_MONTH: "YYYY-MM",
    ARCHIVE_YEAR: "YYYY",
    ARCHIVE_WEEK: "gggg-[W]ww"
};
