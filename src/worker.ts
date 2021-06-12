/* eslint-disable class-methods-use-this,@typescript-eslint/no-empty-function,@typescript-eslint/ban-types */
export type WorkerProcess = {
  onStart?: () => Promise<void>;
  onStop?: () => Promise<void>;
  onProcess: () => Promise<number>;
};

export type WorkerOptions = {
  name: string;
  process: WorkerProcess;
  delayOnError?: number;
};

export type Listener<Event> = (event: Event) => void;

export type WorkerStatus = 'stopped' | 'starting' | 'started' | 'stopping' | 'failed';

export class Worker {
  private readonly name: string;

  private status: WorkerStatus = 'stopped';

  private process: WorkerProcess;

  private readonly delayOnError: number;

  private timeout?: NodeJS.Timeout;

  private statusListeners: Set<Listener<Worker>> = new Set();

  constructor(options: WorkerOptions) {
    this.name = options.name;
    this.process = options.process;
    this.delayOnError = options.delayOnError ?? 30000;
  }

  public getName(): string {
    return this.name;
  }

  public getStatus(): WorkerStatus {
    return this.status;
  }

  public addStatusListener(listener: Listener<Worker>): void {
    this.statusListeners.add(listener);
  }

  public removeStatusListener(listener: Listener<Worker>): void {
    this.statusListeners.delete(listener);
  }

  private setStatus(status: WorkerStatus): void {
    this.status = status;
    this.statusListeners.forEach(listener => listener(this));
  }

  public async start(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'failed') {
      this.setStatus('starting');
      try {
        await this.process.onStart?.();
        this.scheduleProcess(0);
        this.setStatus('started');
      } catch (error) {
        this.setStatus('failed');
      }
    }
  }

  public async stop(): Promise<void> {
    if (this.status === 'started') {
      this.cancelProcess();
      this.setStatus('stopping');
      try {
        await this.process.onStop?.();
        this.setStatus('stopped');
      } catch (error) {
        this.setStatus('failed');
      }
    }
  }

  private cancelProcess(): void {
    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  private scheduleProcess(delay: number): void {
    this.cancelProcess();
    this.timeout = setTimeout(() => {
      this.process
        .onProcess()
        .then(nextDelay => this.scheduleProcess(nextDelay))
        .catch(() => this.scheduleProcess(this.delayOnError));
    }, delay);
  }
}
