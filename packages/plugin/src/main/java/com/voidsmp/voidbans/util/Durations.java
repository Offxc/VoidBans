package com.voidsmp.voidbans.util;

import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the durations staff type in commands ("30m", "7d", "1d12h") and
 * writes durations back out in the same short form.
 */
public final class Durations {

    private static final Pattern WHOLE = Pattern.compile("^(?:\\d{1,6}(?:mo|[smhdwy]))+$");
    private static final Pattern PART = Pattern.compile("(\\d{1,6})(mo|[smhdwy])");
    private static final long MAX_SECONDS = 20L * 365 * 86_400;

    private Durations() {}

    /** Seconds for input like "7d" or "1d12h", or null if it isn't a duration. */
    public static Long parseSeconds(String input) {
        String text = input.toLowerCase();
        if (!WHOLE.matcher(text).matches()) return null;

        long total = 0;
        Matcher m = PART.matcher(text);
        while (m.find()) {
            long unit = switch (m.group(2)) {
                case "s" -> 1L;
                case "m" -> 60L;
                case "h" -> 3_600L;
                case "d" -> 86_400L;
                case "w" -> 604_800L;
                case "mo" -> 2_592_000L;
                default -> 31_536_000L; // y
            };
            total += Long.parseLong(m.group(1)) * unit;
        }
        return total > 0 && total <= MAX_SECONDS ? total : null;
    }

    /** "7d", "2h 30m", "45s". Shows the two largest units and rounds up to the minute. */
    public static String human(Duration duration) {
        long seconds = Math.max(0, duration.getSeconds());
        if (seconds < 60) return seconds + "s";
        seconds = (seconds + 59) / 60 * 60;

        long days = seconds / 86_400;
        long hours = seconds % 86_400 / 3_600;
        long minutes = seconds % 3_600 / 60;

        if (days > 0) return hours > 0 ? days + "d " + hours + "h" : days + "d";
        if (hours > 0) return minutes > 0 ? hours + "h " + minutes + "m" : hours + "h";
        return minutes + "m";
    }
}
