/* eslint-disable dot-notation,@typescript-eslint/no-empty-function,@typescript-eslint/no-explicit-any,no-empty */
import { Worker } from './worker';
import SpyInstance = jest.SpyInstance;

jest.useFakeTimers();

interface TestConfig {
  test: string;
}

describe('Worker', () => {
  const name = 'testWorker';
  const config: TestConfig = { test: 'test' };
  const delayOnError = 30000;

  let spySetStatus: SpyInstance;
  let spyCancelProcess: SpyInstance;
  let spyScheduleProcess: SpyInstance;
  let spyOnStart: SpyInstance;
  let spyOnStop: SpyInstance;
  let spyOnProcess: SpyInstance;

  beforeEach(() => {
    jest.clearAllTimers();
    ((setTimeout as any) as SpyInstance).mockClear();
    ((clearTimeout as any) as SpyInstance).mockClear();
    spySetStatus = jest.spyOn<any, string>(Worker.prototype, 'setStatus');
    spyCancelProcess = jest.spyOn<any, string>(Worker.prototype, 'cancelProcess');
    spyScheduleProcess = jest.spyOn<any, string>(Worker.prototype, 'scheduleProcess');
    spyOnStart = jest.spyOn<any, string>(Worker.prototype, 'onStart');
    spyOnStop = jest.spyOn<any, string>(Worker.prototype, 'onStop');
    spyOnProcess = jest.spyOn<any, string>(Worker.prototype, 'onProcess');
  });

  afterEach(() => {
    spySetStatus.mockRestore();
    spyCancelProcess.mockRestore();
    spyScheduleProcess.mockRestore();
    spyOnStart.mockRestore();
    spyOnStop.mockRestore();
    spyOnProcess.mockRestore();
  });

  describe('constructor()', () => {
    test('should configure the instance', () => {
      const worker = new Worker({ name, config, delayOnError });
      expect(worker['name']).toBe(name);
      expect(worker['config']).toBe(config);
      expect(worker['delayOnError']).toBe(delayOnError);
    });
  });

  describe('getName()', () => {
    test('should return the name', () => {
      const worker = new Worker({ name, config });
      expect(worker.getName()).toBe(name);
    });
  });

  describe('getStatus()', () => {
    test('should return the status', () => {
      const worker = new Worker({ name, config });
      expect(worker.getStatus()).toBe('stopped');
    });
  });

  describe('reconfigure()', () => {
    test('should replace the config', () => {
      const newConfig: TestConfig = { test: 'new' };
      const worker = new Worker({ name, config });
      worker.reconfigure(newConfig, false);
      expect(worker['config']).toBe(newConfig);
    });

    test('should schedule onProcess when processImmediately is true', () => {
      const newConfig: TestConfig = { test: 'new' };
      const worker = new Worker({ name, config });
      worker.reconfigure(newConfig, true);
      expect(worker['config']).toBe(newConfig);
      expect(spyScheduleProcess).toHaveBeenCalled();
    });
  });

  describe('addStatusListener()', () => {
    test('should add the listener', () => {
      const worker = new Worker({ name, config });
      const listener = jest.fn();
      worker.addStatusListener(listener);
      expect(worker['listeners']).toContain(listener);
    });
  });

  describe('removeStatusListener()', () => {
    test('should remove the listener', () => {
      const worker = new Worker({ name, config });
      const listener = jest.fn();
      worker.addStatusListener(listener);
      worker.removeStatusListener(listener);
      expect(worker['listeners'].size).toBe(0);
    });
  });

  describe('setStatus()', () => {
    test('should set the status and notify the status listeners', () => {
      const worker = new Worker({ name, config });
      const listener = jest.fn();
      worker.addStatusListener(listener);
      worker['setStatus']('failed');
      expect(worker['status']).toBe('failed');
      expect(listener).toHaveBeenCalledWith(worker);
    });
  });

  describe('start()', () => {
    test('should do nothing when the worker is not stopped or failed', async () => {
      const worker = new Worker({ name, config });
      worker['status'] = 'started';
      await worker.start();
      expect(spySetStatus).not.toHaveBeenCalled();
      expect(spyOnStart).not.toHaveBeenCalled();
      expect(spyScheduleProcess).not.toHaveBeenCalled();
    });

    test('should start the worker when onStart() resolves', async () => {
      const worker = new Worker({ name, config });
      spyOnStart.mockResolvedValue(true);
      await worker.start();
      expect(spySetStatus).toHaveBeenCalledTimes(2);
      expect(spySetStatus).toHaveBeenNthCalledWith(1, 'starting');
      expect(spySetStatus).toHaveBeenNthCalledWith(2, 'started');
      expect(spyOnStart).toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledWith(0);
      expect(spyOnStart.mock.invocationCallOrder[0]).toBeGreaterThan(spySetStatus.mock.invocationCallOrder[0]);
      expect(spySetStatus.mock.invocationCallOrder[1]).toBeGreaterThan(spyOnStart.mock.invocationCallOrder[0]);
      expect(spyScheduleProcess.mock.invocationCallOrder[0]).toBeGreaterThan(spySetStatus.mock.invocationCallOrder[1]);
    });

    test('should set the worker to failed when onStart() rejects', async () => {
      const worker = new Worker({ name, config });
      spyOnStart.mockRejectedValue(new TypeError());
      await worker.start();
      expect(spySetStatus).toHaveBeenCalledTimes(2);
      expect(spySetStatus).toHaveBeenNthCalledWith(1, 'starting');
      expect(spySetStatus).toHaveBeenNthCalledWith(2, 'failed');
      expect(spyOnStart).toHaveBeenCalled();
      expect(spyScheduleProcess).not.toHaveBeenCalled();
      expect(spyOnStart.mock.invocationCallOrder[0]).toBeGreaterThan(spySetStatus.mock.invocationCallOrder[0]);
      expect(spySetStatus.mock.invocationCallOrder[1]).toBeGreaterThan(spyOnStart.mock.invocationCallOrder[0]);
    });
  });

  describe('cancelProcess()', () => {
    test('should do nothing when there is no onProcess() scheduled', () => {
      const worker = new Worker({ name, config });
      worker['cancelProcess']();
      expect(clearTimeout).not.toHaveBeenCalled();
    });

    test('should clear the scheduled onProcess()', async () => {
      const worker = new Worker({ name, config });
      worker['timeout'] = setTimeout(() => {}, 0);
      worker['cancelProcess']();
      expect(worker['timeout']).toBeUndefined();
      expect(clearTimeout).toHaveBeenCalled();
    });
  });

  describe('scheduleProcess()', () => {
    test('should do nothing when the worker is not started', () => {
      const worker = new Worker({ name, config });
      worker['scheduleProcess'](0);
      expect(setTimeout).not.toHaveBeenCalled();
    });

    test('should schedule onProcess(), call it and schedule it using its returned value', async () => {
      const worker = new Worker({ name, config });
      worker['status'] = 'started';
      spyOnProcess.mockResolvedValue(10000);
      worker['scheduleProcess'](5000);
      expect(spyCancelProcess).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(spyOnProcess).not.toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledTimes(1);
      jest.runOnlyPendingTimers();
      await spyOnProcess.mock.results[0].value;
      expect(spyCancelProcess).toHaveBeenCalledTimes(2);
      expect(setTimeout).toHaveBeenCalledTimes(2);
      expect(spyOnProcess).toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledTimes(2);
      expect(spyScheduleProcess).toHaveBeenNthCalledWith(2, 10000);
    });

    test('should schedule onProcess(), call it and schedule it after delayOnError when it throws', async () => {
      const worker = new Worker({ name, config });
      worker['status'] = 'started';
      spyOnProcess.mockRejectedValue(new TypeError());
      worker['scheduleProcess'](5000);
      expect(spyCancelProcess).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(spyOnProcess).not.toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledTimes(1);
      jest.runOnlyPendingTimers();
      try {
        await spyOnProcess.mock.results[0].value;
      } catch (error) {}
      expect(spyCancelProcess).toHaveBeenCalledTimes(2);
      expect(setTimeout).toHaveBeenCalledTimes(2);
      expect(spyOnProcess).toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledTimes(2);
      expect(spyScheduleProcess).toHaveBeenNthCalledWith(2, worker['delayOnError']);
    });

    test('should schedule onProcess() and not call it when the worker status has changed to not started in the meantime', async () => {
      const worker = new Worker({ name, config });
      worker['status'] = 'started';
      spyOnProcess.mockResolvedValue(10000);
      worker['scheduleProcess'](5000);
      expect(spyCancelProcess).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(spyOnProcess).not.toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledTimes(1);
      worker['status'] = 'stopped';
      jest.runOnlyPendingTimers();
      expect(spyCancelProcess).toHaveBeenCalledTimes(1);
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(spyOnProcess).not.toHaveBeenCalled();
      expect(spyScheduleProcess).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    test('should do nothing when the worker is not started', async () => {
      const worker = new Worker({ name, config });
      await worker['stop']();
      expect(spyCancelProcess).not.toHaveBeenCalled();
      expect(spySetStatus).not.toHaveBeenCalled();
      expect(spyOnStop).not.toHaveBeenCalled();
    });

    test('should stop the worker when onStop() resolves', async () => {
      const worker = new Worker({ name, config });
      worker['status'] = 'started';
      spyOnStop.mockResolvedValue(true);
      await worker['stop']();
      expect(spyCancelProcess).toHaveBeenCalled();
      expect(spySetStatus).toHaveBeenCalledTimes(2);
      expect(spySetStatus).toHaveBeenNthCalledWith(1, 'stopping');
      expect(spySetStatus).toHaveBeenNthCalledWith(2, 'stopped');
      expect(spyOnStop).toHaveBeenCalled();
      expect(spySetStatus.mock.invocationCallOrder[0]).toBeGreaterThan(spyCancelProcess.mock.invocationCallOrder[0]);
      expect(spyOnStop.mock.invocationCallOrder[0]).toBeGreaterThan(spySetStatus.mock.invocationCallOrder[0]);
      expect(spySetStatus.mock.invocationCallOrder[1]).toBeGreaterThan(spyOnStop.mock.invocationCallOrder[0]);
    });

    test('should stop the worker when onStop() rejects', async () => {
      const worker = new Worker({ name, config });
      worker['status'] = 'started';
      spyOnStop.mockRejectedValue(new TypeError());
      await worker['stop']();
      expect(spyCancelProcess).toHaveBeenCalled();
      expect(spySetStatus).toHaveBeenCalledTimes(2);
      expect(spySetStatus).toHaveBeenNthCalledWith(1, 'stopping');
      expect(spySetStatus).toHaveBeenNthCalledWith(2, 'failed');
      expect(spyOnStop).toHaveBeenCalled();
      expect(spySetStatus.mock.invocationCallOrder[0]).toBeGreaterThan(spyCancelProcess.mock.invocationCallOrder[0]);
      expect(spyOnStop.mock.invocationCallOrder[0]).toBeGreaterThan(spySetStatus.mock.invocationCallOrder[0]);
      expect(spySetStatus.mock.invocationCallOrder[1]).toBeGreaterThan(spyOnStop.mock.invocationCallOrder[0]);
    });
  });

  describe('onStart()', () => {
    test('should do nothing', async () => {
      const worker = new Worker({ name, config });
      await worker['onStart']();
    });
  });

  describe('onStop()', () => {
    test('should fo nothing', async () => {
      const worker = new Worker({ name, config });
      await worker['onStop']();
    });
  });

  describe('onProcess()', () => {
    test('should throw', async () => {
      expect.assertions(1);
      const worker = new Worker({ name, config });
      try {
        await worker['onProcess']();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
