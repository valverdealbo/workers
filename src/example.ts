/* eslint-disable no-console */
import { Worker, WorkerProcess } from '.';

let counter = 0;
const workerProcess: WorkerProcess = {
  async onProcess(): Promise<number> {
    console.log(`counter = ${(counter += 1)}`);
    return 1000;
  },
};

function listener(worker: Worker): void {
  console.log(`worker status = ${worker.getStatus()}`);
}

async function run(): Promise<void> {
  const worker = new Worker({ name: 'counter', process: workerProcess });
  worker.addStatusListener(listener);

  let shuttingDown = false;
  function shutdown(): void {
    if (!shuttingDown) {
      shuttingDown = true;
      worker
        .stop()
        .then(() => process.exit())
        .catch(() => process.exit());
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
  process.exit();
});
