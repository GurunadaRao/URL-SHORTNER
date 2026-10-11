import { describe, expect, it } from 'vitest';
import { Base62 } from '../src/utils/base62';

describe('Base62 Utility', () => {
  it('should encode 0 as "0"', () => {
    expect(Base62.encode(0)).toBe('0');
    expect(Base62.encode(0n)).toBe('0');
  });

  it('should encode small numbers correctly', () => {
    expect(Base62.encode(1)).toBe('1');
    expect(Base62.encode(9)).toBe('9');
    expect(Base62.encode(10)).toBe('a');
    expect(Base62.encode(35)).toBe('z');
    expect(Base62.encode(36)).toBe('A');
    expect(Base62.encode(61)).toBe('Z');
    expect(Base62.encode(62)).toBe('10');
  });

  it('should correctly roundtrip encode and decode arbitrary numbers', () => {
    const testCases = [
      1n,
      62n,
      125n,
      1000000n,
      1000000000n,
      987654321012345n,
      BigInt(Number.MAX_SAFE_INTEGER) + 100n,
    ];

    for (const id of testCases) {
      const encoded = Base62.encode(id);
      const decoded = Base62.decode(encoded);
      expect(decoded).toBe(id);
    }
  });

  it('should produce 6 to 7 character strings for high ID ranges', () => {
    // 62^5 = 916,132,832
    // 62^6 = 56,800,235,584
    const id = 1000000000n; // 1 billion
    const encoded = Base62.encode(id);
    expect(encoded.length).toBe(6);
    expect(Base62.decode(encoded)).toBe(id);
  });

  it('should validate valid Base62 strings', () => {
    expect(Base62.isValid('abcXYZ012')).toBe(true);
    expect(Base62.isValid('')).toBe(false);
    expect(Base62.isValid('abc-123')).toBe(false);
    expect(Base62.isValid('abc!123')).toBe(false);
  });

  it('should throw an error for negative numbers', () => {
    expect(() => Base62.encode(-1)).toThrow('Base62 encoding only supports non-negative integers');
  });

  it('should throw an error for invalid decode characters', () => {
    expect(() => Base62.decode('invalid#char')).toThrow("Invalid Base62 character: '#'");
  });
});
