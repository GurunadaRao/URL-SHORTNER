/**
 * Base62 Encoding and Decoding Utility
 *
 * Alphabet: 0-9, a-z, A-Z (62 characters)
 * - Deterministic, collision-free conversion of 64-bit numeric IDs.
 * - Handles arbitrary size integers using native BigInt to avoid IEEE 754 precision limits.
 */

const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = BigInt(62);

// Lookup table for O(1) decode character indexing
const CHAR_MAP: Record<string, bigint> = {};
for (let i = 0; i < BASE62_ALPHABET.length; i++) {
  CHAR_MAP[BASE62_ALPHABET[i]] = BigInt(i);
}

export class Base62 {
  /**
   * Encodes a non-negative integer (number or bigint) to a Base62 string.
   */
  public static encode(value: bigint | number): string {
    let num = typeof value === 'number' ? BigInt(value) : value;

    if (num < 0n) {
      throw new Error('Base62 encoding only supports non-negative integers');
    }

    if (num === 0n) {
      return BASE62_ALPHABET[0];
    }

    let encoded = '';
    while (num > 0n) {
      const remainder = Number(num % BASE);
      encoded = BASE62_ALPHABET[remainder] + encoded;
      num = num / BASE;
    }

    return encoded;
  }

  /**
   * Decodes a Base62 string back into its original BigInt numeric ID.
   */
  public static decode(str: string): bigint {
    if (!str || str.length === 0) {
      throw new Error('Cannot decode an empty string');
    }

    let result = 0n;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const val = CHAR_MAP[char];
      if (val === undefined) {
        throw new Error(`Invalid Base62 character: '${char}'`);
      }
      result = result * BASE + val;
    }

    return result;
  }

  /**
   * Validates if a string is a valid Base62 string.
   */
  public static isValid(str: string): boolean {
    if (!str || str.length === 0) return false;
    return /^[0-9a-zA-Z]+$/.test(str);
  }
}
