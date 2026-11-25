package com.voidsmp.voidbans.staff;

/** Just enough JSON writing for audit details and webhook posts. */
final class Json {
    private Json() {}

    static String quote(String s) {
        if (s == null) return "null";
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (ch < 0x20) out.append(String.format("\\u%04x", (int) ch));
                    else out.append(ch);
                }
            }
        }
        return out.append('"').toString();
    }

    /** An object of text values, given as name, value, name, value. */
    static String object(String... pairs) {
        StringBuilder out = new StringBuilder("{");
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            if (i > 0) out.append(',');
            out.append(quote(pairs[i])).append(':').append(quote(pairs[i + 1]));
        }
        return out.append('}').toString();
    }

    /** The text inside a JSON string value such as "https:\/\/...", or null if it is not a string. */
    static String unquote(String json) {
        if (json == null) return null;
        String s = json.trim();
        if (s.length() < 2 || s.charAt(0) != '"' || s.charAt(s.length() - 1) != '"') return null;
        return s.substring(1, s.length() - 1).replace("\\/", "/").replace("\\\"", "\"").replace("\\\\", "\\");
    }
}
