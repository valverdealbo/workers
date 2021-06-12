# @valbo/workers

Run code in the background with a configurable frequency.

![npm (scoped)](https://img.shields.io/npm/v/@valbo/workers)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
![Build Status](https://img.shields.io/github/workflow/status/valverdealbo/workers/CI)
[![Coverage Status](https://coveralls.io/repos/github/valverdealbo/workers/badge.svg?branch=main)](https://coveralls.io/github/valverdealbo/workers?branch=main)
[![Known Vulnerabilities](https://snyk.io/test/github/valverdealbo/workers/badge.svg?targetFile=package.json)](https://snyk.io/test/github/valverdealbo/workers?targetFile=package.json)

## Install

```bash
npm install @valbo/workers
```

## Usage

First you need to create an object of type **WorkerProcess** with the code to run:

```typescript
import { WorkerProcess } from '@valbo/workers';

const process: WorkerProcess = {
  async onStart(): Promise<void> {
    console.log('onStart() called');
  },
  
  async onStop(): Promise<void> {
    console.log('onStop() called');
  },
  
  async onProcess(): Promise<number> {
    console.log('onProcess() called, calling it again in 1s');
    return 1000;
  },
};
```

The **WorkerProcess** type has 3 methods:

- An optional **onStart()** method the worker will call when it starts. If it resolves the worker will start and if it rejects the worker will fail.
- An optional **onStop()** method the worker will call when it stops. If it resolves the worker will stop and if it rejects the worker will fail.
- A **onProcess()** method the worker will call repeatedly while started. The worker will wait its resolved value (in ms) to call it again, or a configurable delay (default 30s) if it rejects.

Once you have a **WorkerProcess** object you need to create a **Worker** with it and call **start()** on the worker:

```typescript
import { Worker } from '@valbo/workers';

const worker = new Worker({ name: 'example', process, delayOnError: 15000 });
await worker.start();
```

The **Worker** class has:

- A **status** property which can be **stopped**, **starting**, **started**, **stopping** or **failed**.
- A **start()** and **stop()** methods to start and stop the worker.
- A **addStatusListener()** and **removeStatusListener()** to report changes in its status to whoever is interested.

## Example

See the [example](src/example.ts) file for a full example.