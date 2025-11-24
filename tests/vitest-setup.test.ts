import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should work with basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should handle arrays and objects', () => {
    const arr = [1, 2, 3];
    expect(arr).toContain(2);
    expect(arr).toHaveLength(3);

    const obj = { name: 'test' };
    expect(obj).toHaveProperty('name', 'test');
  });
});