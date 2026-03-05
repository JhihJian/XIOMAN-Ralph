// src/tests/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { callLLM, callAgent } from '../pi/client.js';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('client', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env vars
    const envKeys = ['MODEL', 'RALPH_WORKSPACE', 'ANTHROPIC_BASE_URL'];
    envKeys.forEach(key => {
      if (originalEnv[key]) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
  });

  describe('callLLM', () => {
    it('should call claude CLI with --no-tools flag', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('LLM response'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const result = await callLLM('Test prompt');

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--no-tools', '-p', 'Test prompt'],
        expect.objectContaining({
          cwd: expect.any(String),
          env: expect.objectContaining({
            ANTHROPIC_BASE_URL: expect.any(String),
            MODEL: expect.any(String),
          }),
        })
      );

      expect(result).toBe('LLM response');
    });

    it('should pass environment variables to child process', async () => {
      process.env.MODEL = 'claude-opus-4-6';
      process.env.ANTHROPIC_BASE_URL = 'https://custom.api.com';
      process.env.RALPH_WORKSPACE = '/custom/workspace';

      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Response'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await callLLM('Test');

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      expect(spawnCall[2]!.env!.MODEL).toBe('claude-opus-4-6');
      expect(spawnCall[2]!.env!.ANTHROPIC_BASE_URL).toBe('https://custom.api.com');
      expect(spawnCall[2]!.cwd).toBe('/custom/workspace');
    });

    it('should throw error on non-zero exit code', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Some output'));
            }
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Error message'));
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await expect(callLLM('Test')).rejects.toThrow('Claude CLI failed (1): Error message');
    });

    it('should throw error when spawn fails', async () => {
      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Spawn error'));
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await expect(callLLM('Test')).rejects.toThrow('Failed to spawn claude: Spawn error');
    });
  });

  describe('callAgent', () => {
    it('should call claude CLI with --allowedTools flag', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Agent response'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      const result = await callAgent('Test prompt');

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--allowedTools', 'Read,Write,Edit,Bash(*)', '-p', 'Test prompt'],
        expect.objectContaining({
          cwd: expect.any(String),
          env: expect.objectContaining({
            ANTHROPIC_BASE_URL: expect.any(String),
            MODEL: expect.any(String),
          }),
        })
      );

      expect(result).toBe('Agent response');
    });

    it('should pass environment variables to child process', async () => {
      process.env.MODEL = 'claude-sonnet-4-5';
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      process.env.RALPH_WORKSPACE = '/workspace';

      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Response'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await callAgent('Test');

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      expect(spawnCall[2]!.env!.MODEL).toBe('claude-sonnet-4-5');
      expect(spawnCall[2]!.env!.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
      expect(spawnCall[2]!.cwd).toBe('/workspace');
    });

    it('should throw error on non-zero exit code', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Some output'));
            }
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Agent error'));
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(2);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await expect(callAgent('Test')).rejects.toThrow('Claude CLI failed (2): Agent error');
    });

    it('should use stdout in error message if stderr is empty', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Stdout error'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await expect(callAgent('Test')).rejects.toThrow('Claude CLI failed (1): Stdout error');
    });
  });
});
