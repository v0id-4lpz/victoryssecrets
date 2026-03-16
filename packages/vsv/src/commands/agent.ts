// agent.ts — vsv agent start|stop|status|refresh

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { promptPassword, resolveFile, isAgentRunning } from '../cli-utils';
import { startAgent } from '../agent/server';
import { createClient } from '../agent/client';
import { getSocketPath, getPidPath, getTokenPath } from '../agent/protocol';

const startCommand = new Command('start')
  .description('Start the agent daemon')
  .option('-f, --file <path>', 'Vault file path (or VSV_FILE)')
  .option('-e, --env <env>', 'Default environment for secret resolution')
  .option('--poll <minutes>', 'Poll interval for remote vault refresh (minutes)', parseFloat)
  .option('-d, --daemon', 'Run in background (detached)')
  .action(async (opts: { file?: string; env?: string; poll?: number; daemon?: boolean }) => {
    const filePath = resolveFile(opts);
    const password = await promptPassword();

    if (opts.daemon) {
      // Pass password via temp file (mode 0600) — never visible in env/args/ps
      const tmpPwFile = getPidPath().replace('.pid', '.pw');
      writeFileSync(tmpPwFile, password, { mode: 0o600 });

      const scriptPath = pathResolve(process.argv[1]!);
      const args = [scriptPath, 'agent', 'start', '-f', pathResolve(filePath)];
      if (opts.env) args.push('-e', opts.env);
      if (opts.poll) args.push('--poll', String(opts.poll));

      const logPath = getPidPath().replace('.pid', '.log');
      const logFd = openSync(logPath, 'a');

      let child;
      try {
        child = spawn(process.execPath, args, {
          detached: true,
          stdio: ['ignore', logFd, logFd],
          env: { ...process.env, VSV_PASSWORD_FILE: tmpPwFile },
        });
      } catch (err) {
        closeSync(logFd);
        if (existsSync(tmpPwFile)) unlinkSync(tmpPwFile);
        throw err;
      }
      // Close our copy of the log fd — child inherits its own
      closeSync(logFd);
      child.unref();

      // Wait for pid file (written after socket listen + chmod) or child exit
      await new Promise<void>((resolve, reject) => {
        const pollTimer = setInterval(() => {
          if (existsSync(getPidPath())) {
            clearInterval(pollTimer);
            clearTimeout(timeoutTimer);
            resolve();
          }
        }, 100);

        child.on('exit', (code) => {
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          if (existsSync(tmpPwFile)) unlinkSync(tmpPwFile);
          reject(new Error(`Agent failed to start (exit ${code}). Check ${logPath}`));
        });

        const timeoutTimer = setTimeout(() => {
          clearInterval(pollTimer);
          child.kill();
          if (existsSync(tmpPwFile)) unlinkSync(tmpPwFile);
          reject(new Error(`Agent start timeout. Check ${logPath}`));
        }, 30_000);
      });

      // Clean up password file
      if (existsSync(tmpPwFile)) unlinkSync(tmpPwFile);

      // Read pid from file
      const pid = readFileSync(getPidPath(), 'utf-8').trim();
      process.stderr.write(`Agent started in background (pid ${pid}, log ${logPath})\n`);
      return;
    }

    // Foreground mode
    await startAgent(filePath, password, opts.env, opts.poll);
  });

const stopCommand = new Command('stop')
  .description('Stop the agent daemon')
  .action(() => {
    const pidPath = getPidPath();
    const socketPath = getSocketPath();
    const tokenPath = getTokenPath();

    if (!existsSync(pidPath)) {
      process.stderr.write('Agent is not running\n');
      process.exit(1);
    }

    const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      process.stderr.write('Invalid PID in agent file, cleaning up\n');
    } else {
      try {
        process.kill(pid, 'SIGTERM');
        process.stderr.write(`Agent stopped (pid ${pid})\n`);
      } catch {
        process.stderr.write(`Agent process ${pid} not found, cleaning up\n`);
      }
    }

    if (existsSync(pidPath)) unlinkSync(pidPath);
    if (existsSync(socketPath)) unlinkSync(socketPath);
    if (existsSync(tokenPath)) unlinkSync(tokenPath);
  });

const statusCommand = new Command('status')
  .description('Check agent status')
  .action(() => {
    const pidPath = getPidPath();
    const socketPath = getSocketPath();

    if (!existsSync(socketPath) || !existsSync(pidPath)) {
      process.stdout.write('Agent is not running\n');
      process.exit(1);
    }

    const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      process.stdout.write('Agent is not running (corrupt pid file)\n');
      unlinkSync(pidPath);
      if (existsSync(socketPath)) unlinkSync(socketPath);
      const tokenPath = getTokenPath();
      if (existsSync(tokenPath)) unlinkSync(tokenPath);
      process.exit(1);
    }
    try {
      process.kill(pid, 0); // Check if process exists
      process.stdout.write(`Agent running (pid ${pid}, socket ${socketPath})\n`);
    } catch {
      process.stdout.write('Agent is not running (stale pid file)\n');
      unlinkSync(pidPath);
      if (existsSync(socketPath)) unlinkSync(socketPath);
      const tokenPath = getTokenPath();
      if (existsSync(tokenPath)) unlinkSync(tokenPath);
      process.exit(1);
    }
  });

const refreshCommand = new Command('refresh')
  .description('Force refresh of a remote vault')
  .action(async () => {
    if (!isAgentRunning()) {
      process.stderr.write('Agent is not running\n');
      process.exit(1);
    }
    const client = createClient();
    try {
      await client.refresh();
      process.stderr.write('Remote vault refreshed\n');
    } catch (err) {
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    } finally {
      client.disconnect();
    }
  });

export const agentCommand = new Command('agent')
  .description('Manage the vsv agent daemon')
  .addCommand(startCommand)
  .addCommand(stopCommand)
  .addCommand(statusCommand)
  .addCommand(refreshCommand);
