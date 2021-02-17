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

This package exports an abstract class **Worker** and a subclass of it **WatchWorker**. See the [example](src/example.ts) file for a full example on how 
to use both classes.

### Worker class

The **Worker** class has:

- A **status** property which can be **stopped**, **starting**, **started** or **stopping**.
- A **start()** and **stop()** methods to start and stop the worker.
- A **onProcess()**, **onStart()** and **onStop()** methods that you can override by subclassing **Worker**.
- A **addStatusListener()** and **removeStatusListener()** to report changes in its status.
- A generic **config** property to store anything you need in your worker.

Once started, a Worker will keep calling **onProcess()** again and again until it is stopped. In the **onProcess()** method you must implement whatever it is 
that you want your worker to do, and then return the number of milliseconds you want to wait until **onProcess()** is called again. If **onProcess()** throws 
then the worker will wait for **delayOnError** milliseconds, which is 30000 by default and configurable in the constructor.

You can also override **onStart()** and **onStop()** if you want your worker to execute some code when it starts or stops.

The worker can report changes in its status to other objects. Just implement the **Listener** interface and call the **addStatusListener()** and **removeStatusListener()** methods.

### WatchWorker class

The **WatchWorker** class extends the **Worker** class by watching a MongoDB collection and updating its **config** property when one document in the collection changes.

You need to provide a MongoDB collection and a filter to find the config in it:

- The collection needs to be already connected to the database when you provide it.
- The filter will be matched against the [change streams](https://docs.mongodb.com/manual/changeStreams/) events from the collection.

The **WatchWorker** class uses the **onStart()** and **onStop()** methods to open and close the change stream, so if you override these methods you have to call 
**super.onStart()** and **super.onStop()** in them.
