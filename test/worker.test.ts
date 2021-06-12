/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker, WorkerProcess } from '../src/worker';

describe('Worker', () => {
  const name = 'testWorker';
  const onProcessReturn = 1000;
  const delayOnError = 15000;

  const listener = jest.fn<void, [Worker]>();
  const onStart = jest.fn<Promise<void>, []>();
  const onStop = jest.fn<Promise<void>, []>();
  const onProcess = jest.fn<Promise<number>, []>();
  const process: WorkerProcess = { onStart, onStop, onProcess };

  beforeEach(() => {
    jest.useFakeTimers();
    listener.mockClear();
    onStart.mockClear();
    onStart.mockImplementation(() => Promise.resolve());
    onStop.mockClear();
    onStop.mockImplementation(() => Promise.resolve());
    onProcess.mockClear();
    onProcess.mockImplementation(() => Promise.resolve(onProcessReturn));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getName()', () => {
    test('should return the name', () => {
      const worker = new Worker({ name, process });
      expect(worker.getName()).toBe(name);
    });
  });

  describe('getStatus()', () => {
    test('should return the status', () => {
      const worker = new Worker({ name, process });
      expect(worker.getStatus()).toBe('stopped');
    });
  });

  describe('addStatusListener()', () => {
    test('should add the listener', async () => {
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.start();
      expect(listener).toHaveBeenCalledTimes(2);
      await worker.stop();
      expect(listener).toHaveBeenCalledTimes(4);
    });
  });

  describe('removeStatusListener()', () => {
    test('should remove the listener', async () => {
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      worker.removeStatusListener(listener);
      await worker.start();
      await worker.stop();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('start()', () => {
    test('should do nothing when the worker is not stopped or failed', async () => {
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.start();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(onStart).toHaveBeenCalledTimes(1);
      await worker.start();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(worker.getStatus()).toBe('started');
    });

    test('should start the worker when onStart() resolves', async () => {
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.start();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(worker.getStatus()).toBe('started');
    });

    test('should set the worker to failed when onStart() rejects', async () => {
      onStart.mockImplementation(() => Promise.reject());
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.start();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(worker.getStatus()).toBe('failed');
    });
  });

  describe('stop()', () => {
    test('should do nothing when the worker is not started', async () => {
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.stop();
      expect(listener).not.toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();
      expect(worker.getStatus()).toBe('stopped');
    });

    test('should stop the worker when onStop() resolves', async () => {
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.start();
      await worker.stop();
      expect(listener).toHaveBeenCalledTimes(4);
      expect(onStop).toHaveBeenCalled();
      expect(worker.getStatus()).toBe('stopped');
    });

    test('should set the worker to failed when onStop() rejects', async () => {
      onStop.mockImplementation(() => Promise.reject());
      const worker = new Worker({ name, process });
      worker.addStatusListener(listener);
      await worker.start();
      await worker.stop();
      expect(listener).toHaveBeenCalledTimes(4);
      expect(onStop).toHaveBeenCalled();
      expect(worker.getStatus()).toBe('failed');
    });
  });

  describe('process.onProcess()', () => {
    test('should be called after the worker starts', async () => {
      const worker = new Worker({ name, process });
      await worker.start();
      expect(onProcess).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();
      expect(onProcess).toHaveBeenCalled();
    });

    test('should be scheduled to run again after its return value', async () => {
      const worker = new Worker({ name, process });
      await worker.start();
      expect(onProcess).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(onProcess).toHaveBeenCalledTimes(1);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(onProcess).toHaveBeenCalledTimes(2);
    });

    test('should be scheduled to run again after the default delayOnError when it throws', async () => {
      onProcess.mockImplementation(() => Promise.reject());
      const worker = new Worker({ name, process });
      await worker.start();
      expect(onProcess).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(onProcess).toHaveBeenCalledTimes(1);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      expect(onProcess).toHaveBeenCalledTimes(2);
    });

    test('should be scheduled to run again after a custom delayOnError when it throws', async () => {
      onProcess.mockImplementation(() => Promise.reject());
      const worker = new Worker({ name, process, delayOnError });
      await worker.start();
      expect(onProcess).not.toHaveBeenCalled();
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(onProcess).toHaveBeenCalledTimes(1);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.runOnlyPendingTimers();
      expect(onProcess).toHaveBeenCalledTimes(2);
    });

    test('should not run when the worker is stopped before the timeout expires', async () => {
      const worker = new Worker({ name, process, delayOnError });
      await worker.start();
      await worker.stop();
      jest.runOnlyPendingTimers();
      expect(onProcess).not.toHaveBeenCalled();
    });
  });
});
