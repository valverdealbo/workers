/* eslint-disable no-console */
import { Worker } from '.';

interface CounterConfig {
  counter: number;
  frequency: number;
}

class CounterWorker extends Worker<CounterConfig> {
  async onProcess(): Promise<number> {
    console.log(`[${this.name}] counter = ${this.config.counter}`);
    this.config.counter += 1;
    return this.config.frequency;
  }
}

function listener(worker: Worker<CounterConfig>): void {
  console.log(`worker [${worker.getName()}] status = ${worker.getStatus()}`);
}

async function run(): Promise<void> {
  const worker = new CounterWorker({ name: 'COUNTER', config: { counter: 1, frequency: 1000 } });
  worker.addStatusListener(listener);

  let shuttingDown = false;
  function shutdown(): void {
    if (!shuttingDown) {
      shuttingDown = true;
      worker.stop().then(() => process.exit(0));
    }
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await worker.start();
}

console.log('workers example: a worker that increases a counter every 1s');
console.log('send a SIGINT or SIGTERM to stop the process');
run().catch(error => {
  console.error(error.message);
  process.exit(-1);
});
