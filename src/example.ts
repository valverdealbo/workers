/* eslint-disable import/no-extraneous-dependencies,max-classes-per-file,class-methods-use-this,@typescript-eslint/no-empty-function,no-console */
import { ChangeEvent, FilterQuery, MongoClient, ReadPreference } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { WatchWorker, Worker } from '.';

interface CounterConfig {
  name: string;
  counter: number;
  frequency: number;
}

// Worker that logs a counter with a frequency
// The counter value and the log frequency are stored in its config
class CounterWorker extends Worker<CounterConfig> {
  async onProcess(): Promise<number> {
    console.log(`[${this.name}] counter = ${this.config.counter}`);
    this.config.counter += 1;
    return this.config.frequency;
  }
}

// Same as above but it watches a MongoDB collection and reloads its config from there when it changes
class WatchCounterWorker extends WatchWorker<CounterConfig> {
  async onProcess(): Promise<number> {
    console.log(`[${this.name}] counter = ${this.config.counter}`);
    this.config.counter += 1;
    if (this.config.counter % 10 === 0) {
      console.log(`[${this.name}] saving config to DB, which should trigger another onProcess() immediately`);
      await this.watchCollection.findOneAndUpdate({ name: this.name }, { $set: { counter: this.config.counter } });
    }
    return this.config.frequency;
  }
}

function listener(worker: Worker<CounterConfig>): void {
  console.log(`worker [${worker.getName()}] status = ${worker.getStatus()}`);
}

async function run(): Promise<void> {
  const server = new MongoMemoryReplSet({ replSet: { storageEngine: 'wiredTiger' }, binary: { version: '4.4.3' } });
  await server.waitUntilRunning();
  const uri = await server.getUri();
  const databaseName = await server.getDbName();
  const mongoClient = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    readPreference: ReadPreference.PRIMARY,
    readConcern: { level: 'majority' },
    w: 'majority',
  });

  const counterName = 'COUNTER';
  const counterConfig: CounterConfig = {
    name: counterName,
    counter: 1,
    frequency: 3000,
  };

  const watchCounterName = 'WATCH_COUNTER';
  const watchCounterConfig: CounterConfig = {
    name: watchCounterName,
    counter: 1,
    frequency: 3000,
  };

  const filter: FilterQuery<ChangeEvent<CounterConfig>> = { 'fullDocument.name': watchCounterName };

  const collection = mongoClient.db(databaseName).collection<CounterConfig>('workers');
  await collection.insertOne(watchCounterConfig);

  const workers = [
    new CounterWorker({ name: counterName, config: counterConfig }),
    new WatchCounterWorker({ name: watchCounterName, config: watchCounterConfig, collection, filter }),
  ];
  workers.forEach(worker => worker.addStatusListener(listener));

  let shuttingDown = false;

  function shutdown(): void {
    if (!shuttingDown) {
      shuttingDown = true;
      Promise.all(workers.map(worker => worker.stop()))
        .then(() => mongoClient.close(true))
        .then(() => process.exit(0));
    }
  }

  process.on('SIGINT', shutdown); // we can stop this script via CTRL-C if we run it in the terminal
  process.on('SIGTERM', shutdown); // or by killing the process if run by some process manager like systemd

  workers.forEach(worker => worker.start().then());
}

run().catch(error => {
  console.error(error.message);
  process.exit(-1);
});
