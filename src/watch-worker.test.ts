/* eslint-disable import/no-extraneous-dependencies,dot-notation,@typescript-eslint/no-explicit-any */
import { ChangeEvent, Collection, FilterQuery, MongoClient, MongoError, ReadPreference } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { WatchWorker } from './watch-worker';

interface Config {
  name: string;
  counter: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('WatchWorker', () => {
  const name = 'testWorker';
  let server: MongoMemoryReplSet;
  let uri: string;
  let databaseName: string;
  let mongoClient: MongoClient;
  let collection: Collection<Config>;
  const filter: FilterQuery<ChangeEvent<Config>> = { 'fullDocument.name': name };
  const config: Config = { name, counter: 0 };

  beforeAll(async () => {
    server = new MongoMemoryReplSet({ binary: { version: '4.4.0' }, replSet: { storageEngine: 'wiredTiger' } });
    await server.waitUntilRunning();
    uri = await server.getUri();
    databaseName = await server.getDbName();
    mongoClient = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      readPreference: ReadPreference.PRIMARY,
      readConcern: { level: 'majority' },
      w: 'majority',
    });
    collection = mongoClient.db(databaseName).collection('config');
  });

  beforeEach(async () => {
    await collection.insertOne(config);
  });

  afterEach(async () => {
    await collection.drop();
  });

  afterAll(async () => {
    await mongoClient.close(true);
    await server.stop();
  });

  describe('constructor()', () => {
    test('should configure the instance', () => {
      const worker = new WatchWorker({ name, config, collection, filter });
      expect(worker['watchCollection']).toBe(collection);
      expect(worker['watchFilter']).toBe(filter);
    });
  });

  describe('openStream()', () => {
    test('should set up the change stream', async () => {
      const worker = new WatchWorker({ name, config, collection, filter });
      worker['status'] = 'started';
      worker['openStream']();
      const stream = worker['changeStream'];
      expect(stream).toBeDefined();
      expect(stream?.listeners('change')).toHaveLength(1);
      expect(stream?.listeners('close')).toHaveLength(1);
      worker['status'] = 'stopped';
      await worker['onStop']();
    });

    test('should set up a new change stream when the previous one closes', async () => {
      const worker = new WatchWorker({ name, config, collection, filter });
      worker['status'] = 'started';
      worker['openStream']();
      const firstStream = worker['changeStream'];
      await firstStream?.close();
      const secondStream = worker['changeStream'];
      expect(firstStream?.isClosed()).toBe(true);
      expect(secondStream?.isClosed()).toBe(false);
      expect(secondStream).not.toBe(firstStream);
      worker['status'] = 'stopped';
      await worker['onStop']();
    });

    test('should update the config when the change stream has a full document', async () => {
      const worker = new WatchWorker({ name, config, collection, filter });
      worker['status'] = 'started';
      worker['openStream']();
      worker['changeStream']?.emit('change', { operationType: 'insert', fullDocument: { name, counter: 100 } } as ChangeEvent<Config>);
      await sleep(100);
      expect(worker['config'].counter)?.toBe(100);
      worker['status'] = 'stopped';
      await worker['onStop']();
    });

    test('should capture a change stream error event', async () => {
      const worker = new WatchWorker({ name, config, collection, filter });
      worker['status'] = 'started';
      worker['openStream']();
      worker['changeStream']?.emit('error', new MongoError('change stream error'));
      worker['status'] = 'stopped';
      await worker['onStop']();
    });
  });

  describe('onStart()', () => {
    test('should open the change stream', async () => {
      const spyOpenStream = jest.spyOn<any, string>(WatchWorker.prototype, 'openStream');
      const worker = new WatchWorker({ name, config, collection, filter });
      worker['status'] = 'started';
      await worker['onStart']();
      expect(spyOpenStream).toHaveBeenCalled();
      worker['status'] = 'stopped';
      await worker['onStop']();
      spyOpenStream.mockRestore();
    });
  });

  describe('onStop()', () => {
    test('should close the change stream', async () => {
      const worker = new WatchWorker({ name, config, collection, filter });
      worker['status'] = 'started';
      await worker['onStart']();
      worker['status'] = 'stopped';
      await worker['onStop']();
      expect(worker['changeStream']?.isClosed()).toBe(true);
    });
  });
});
