package com.voidsmp.voidbans.util;

import java.security.SecureRandom;

/**
 * Must stay in lockstep with packages/web/src/lib/ban-id.ts: same alphabet
 * and same length, since IDs generated here are looked up through that web
 * app's validator. IDs are short on purpose so they can be typed from a kick
 * screen. Older IDs were "VB-" plus eight characters and still work on the site.
 */
public final class BanIdGenerator {

    private static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
    private static final int LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private BanIdGenerator() {}

    public static String generate() {
        StringBuilder sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
