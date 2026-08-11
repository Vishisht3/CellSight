import { logger } from './logger';

export type ScheduledTask = {
  name: string;
  intervalMs: number;
  task: () => void | Promise<void>;
  timer?: NodeJS.Timeout;
};

export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map();

  /**
   * Register a recurring task
   */
  register(name: string, intervalMs: number, task: () => void | Promise<void>): void {
    if (this.tasks.has(name)) {
      logger.warn(`Task ${name} already registered. Stopping previous instance.`);
      this.stop(name);
    }

    const scheduledTask: ScheduledTask = {
      name,
      intervalMs,
      task,
    };

    this.tasks.set(name, scheduledTask);
    logger.info(`Task registered: ${name} (interval: ${intervalMs}ms)`);
  }

  /**
   * Start a registered task.
   * The first execution is deferred by one interval so the process can
   * finish binding to its port and pass the Railway healthcheck before
   * any scheduler work blocks the event loop.
   */
  start(name: string): void {
    const scheduledTask = this.tasks.get(name);
    if (!scheduledTask) {
      logger.error(`Task ${name} not found`);
      return;
    }

    if (scheduledTask.timer) {
      logger.warn(`Task ${name} already running`);
      return;
    }

    // Schedule recurring execution — first run happens after one full interval
    scheduledTask.timer = setInterval(() => {
      this.executeTask(scheduledTask);
    }, scheduledTask.intervalMs);

    logger.info(`Task started: ${name}`);
  }

  /**
   * Stop a running task
   */
  stop(name: string): void {
    const scheduledTask = this.tasks.get(name);
    if (!scheduledTask) {
      logger.error(`Task ${name} not found`);
      return;
    }

    if (scheduledTask.timer) {
      clearInterval(scheduledTask.timer);
      scheduledTask.timer = undefined;
      logger.info(`Task stopped: ${name}`);
    }
  }

  /**
   * Start all registered tasks
   */
  startAll(): void {
    for (const [name] of this.tasks) {
      this.start(name);
    }
  }

  /**
   * Stop all running tasks
   */
  stopAll(): void {
    for (const [name] of this.tasks) {
      this.stop(name);
    }
  }

  private async executeTask(scheduledTask: ScheduledTask): Promise<void> {
    try {
      logger.debug(`Executing task: ${scheduledTask.name}`);
      await scheduledTask.task();
    } catch (error) {
      logger.error(`Task ${scheduledTask.name} failed`, { error });
    }
  }
}

export const scheduler = new Scheduler();
