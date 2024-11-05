import { ISettings, TStyle, IPrettyLogStyles } from "../types/index.js";

export function formatNumberAddZeros(value: number, digits = 2, addNumber = 0): string {
    if (value != null && isNaN(value)) {
        return "";
    }

    value = value != null 
        ? value + addNumber 
        : value;
    if (digits === 2) {
        if (value == null) {
            return "--";
        }
        if (value < 10) {
            return "0" + value;
        }

        return value.toString();
    }

    if (value == null) {
        return "---";
    }
    if (value < 10) {
        return "00" + value;
    }

    if (value < 100) {
        return "0" + value;
    }

    return value.toString();
}

export function formatTemplate<LogObj>(settings: ISettings<LogObj>, template: string, values: Record<string, string | number>, hideUnsetPlaceholder = false) {
    const templateString = String(template);
    const ansiColorWrap = (placeholderValue: string, code: [number, number]) => `\u001b[${code[0]}m${placeholderValue}\u001b[${code[1]}m`;

    const styleWrap: (value: string, style: TStyle) => string = (value: string, style: TStyle) => {
        if (style != null && typeof style === "string") {
            return ansiColorWrap(value, prettyLogStyles[style]);
        } else if (style != null && Array.isArray(style)) {
            return style.reduce((prevValue: string, thisStyle: string) => styleWrap(prevValue, thisStyle), value);
        } else {
            if (style != null && style[value.trim()] != null) {
                return styleWrap(value, style[value.trim()]);
            } else if (style != null && style["*"] != null) {
                return styleWrap(value, style["*"]);
            } else {
                return value;
            }
        }
    };

    const defaultStyle: TStyle = null;
    return templateString.replace(/{{(.+?)}}/g, (_, placeholder) => {
        const value = values[placeholder] != null ? String(values[placeholder]) : hideUnsetPlaceholder ? "" : _;
        return settings.stylePrettyLogs
            ? styleWrap(value, settings?.prettyLogStyles?.[placeholder as keyof IPrettyLogStyles] ?? defaultStyle) + ansiColorWrap("", prettyLogStyles.reset)
            : value;
    });
}

export function urlToObject(url: URL) {
    return {
        href: url.href,
        protocol: url.protocol,
        username: url.username,
        password: url.password,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        searchParams: [...url.searchParams].map(([key, value]) => ({ key, value })),
        hash: url.hash,
        origin: url.origin,
    };
}

export const prettyLogStyles: { [name: string]: [number, number] } = {
    reset: [0, 0],

    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29],

    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],

    blackBright: [90, 39],
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39],

    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],

    bgBlackBright: [100, 49],
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49],
};