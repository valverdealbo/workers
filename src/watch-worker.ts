/* eslint-disable @typescript-eslint/ban-types,@typescript-eslint/no-empty-function */
import { ChangeEvent, ChangeStream, Collection, FilterQuery } from 'mongodb';
import { Worker, WorkerOptions } from './worker';

export interface WatchWorkerOptions<Config extends object> extends WorkerOptions<Config> {
  collection: Collection<Config>;
  filter: FilterQuery<ChangeEvent<Config>>;
}

export class WatchWorker<Config extends object> extends Worker<Config> {
  protected changeStream?: ChangeStream<Config>;

  protected watchCollection: Collection<Config>;

  protected watchFilter: FilterQuery<ChangeEvent<Config>>;

  public constructor(options: WatchWorkerOptions<Config>) {
    super(options);
    this.watchCollection = options.collection;
    this.watchFilter = options.filter;
  }

  protected openStream(): void {
    if (this.status === 'starting' || this.status === 'started') {
      this.changeStream?.removeAllListeners().close();
      this.changeStream = this.watchCollection.watch([{ $match: this.watchFilter }], { fullDocument: 'updateLookup' });
      this.changeStream
        ?.on('change', (event: ChangeEvent<Config>) => {
          if ('fullDocument' in event && event.fullDocument !== undefined) {
            this.config = event.fullDocument;
            this.scheduleProcess(0);
          }
        })
        .on('close', () => {
          this.changeStream?.removeAllListeners();
          this.openStream();
        })
        .on('error', () => {});
    }
  }

  protected async onStart(): Promise<void> {
    this.openStream();
  }

  protected async onStop(): Promise<void> {
    await this.changeStream?.close();
  }
}
