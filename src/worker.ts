/* eslint-disable class-methods-use-this,@typescript-eslint/no-empty-function,@typescript-eslint/ban-types */

export interface WorkerOptions<Config extends object> {
  name: string;
  config: Config;
  delayOnError?: number;
}

export type WorkerStatus = 'stopped' | 'starting' | 'started' | 'stopping' | 'failed';

export interface Listener<T> {
  (event: T): void;
}

export class Worker<Config extends object> {
  protected readonly name: string;

  protected config: Config;

  protected status: WorkerStatus = 'stopped';

  protected listeners: Set<Listener<Worker<Config>>> = new Set();

  protected readonly delayOnError: number;

  protected timeout?: NodeJS.Timeout;

  constructor(options: WorkerOptions<Config>) {
    this.name = options.name;
    this.config = options.config;
    this.delayOnError = options.delayOnError ?? 30000;
  }

  public getName(): string {
    return this.name;
  }

  public getStatus(): WorkerStatus {
    return this.status;
  }

  public reconfigure(newConfig: Config): void {
    this.config = newConfig;
  }

  public addStatusListener(listener: Listener<Worker<Config>>): void {
    this.listeners.add(listener);
  }

  public removeStatusListener(listener: Listener<Worker<Config>>): void {
    this.listeners.delete(listener);
  }

  protected setStatus(status: WorkerStatus): void {
    this.status = status;
    this.listeners.forEach(listener => listener(this));
  }

  public async start(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'failed') {
      this.setStatus('starting');
      try {
        await this.onStart();
        this.setStatus('started');
        this.scheduleProcess(0);
      } catch (error) {
        this.setStatus('failed');
      }
    }
  }

  protected cancelProcess(): void {
    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  protected scheduleProcess(delay: number): void {
    this.cancelProcess();
    if (this.status === 'started') {
      this.timeout = setTimeout(() => {
        if (this.status === 'started') {
          this.onProcess()
            .then(nextDelay => this.scheduleProcess(nextDelay))
            .catch(() => this.scheduleProcess(this.delayOnError));
        }
      }, delay);
    }
  }

  public async stop(): Promise<void> {
    if (this.status === 'started') {
      this.cancelProcess();
      this.setStatus('stopping');
      try {
        await this.onStop();
        this.setStatus('stopped');
      } catch (error) {
        this.setStatus('failed');
      }
    }
  }

  /**
   * Override in subclass with your custom start code in it.
   *
   * Will be called once by start().
   *
   * @returns {Promise<void>} Should resolve when the job starts correctly and reject when it fails.
   */
  protected async onStart(): Promise<void> {}

  /**
   * Override in subclass with your custom stop code in it.
   *
   * Will be called once by stop(). Should resolve when the job stops and reject when it fails.
   * @returns {Promise<void>}
   */
  protected async onStop(): Promise<void> {}

  /**
   * Override in subclass with the code to run after every delay.
   *
   * Will be called once by start() and then scheduled to run again after the delay returned.
   *
   * @returns {Promise<number>} Milliseconds to wait until process() is called again. If it throws it will wait for delayOnError.
   */
  protected async onProcess(): Promise<number> {
    throw Error('onProcess() not implemented, subclass Worker and implement it');
  }
}
