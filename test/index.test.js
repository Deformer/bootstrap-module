const io = require('socket.io-client');
const http = require('http');
const axios = require('axios');
const { isString, isNumber, get, head, last } = require('lodash');
require('jest-extended');

let authRoomSocket;
const testUser = {
  login: 'serg1',
  name: 'Sergey Belan',
  password: '123456',
  id: 1
};
const testMessage = 'Hello World';

let agent;
let room;


const isRoom = (room) => isNumber(room.id) && isString(room.title);
const isMessage = (message) => isString(message.text)
  && isString(get(message, 'user.name'))
  && isNumber(get(message, 'user.id'))
  && isString(get(message, 'room.title'))
  && isNumber(get(message, 'room.id'));

/**
 * Setup WS & HTTP servers
 */
beforeAll((done) => {
  authRoomSocket = io.connect(`http://[localhost]:3000/3`, {
    'reconnection delay': 0,
    'reopen delay': 0,
    'force new connection': true,
    transports: ['websocket'],
  });

  agent = axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 200,
    httpAgent: new http.Agent({ keepAlive: true }),
    withCredentials: true
  });

  done();
});

/**
 *  Cleanup WS & HTTP servers
 */
afterAll((done) => {
  done();
});



describe('test case #1', () => {
  test('should communicate', (done) => {
    const socket = io.connect(`http://[localhost]:3000`, {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true,
      transports: ['websocket'],
    });
    socket.on('connect', () => {
      expect(socket.connected).toBeTrue();
      done();
    });
  });

  test('should authorize', async (done) => {
    try {
      let response;

      authRoomSocket.on('new message', (data) => {
        expect(response).toBeObject();
        expect(response.status).toBe(200);

        const user = response.data;
        expect(user).toBeObject();
        expect(user.login).toBe(testUser.login);
        expect(user.name).toBe(testUser.name);
        expect(data).toBeObject();
        expect(data.text).toBe(`User ${testUser.name} logged in`);


        done();
      });

      response = await agent.post(`api/users/login`, {
        login: testUser.login,
        password: testUser.password
      });
    } catch(err) {
      done(err)
    }
  });

  test('should get chat rooms', async (done) => {
    try {
      const response = await agent.get(`api/rooms`);
      expect(response).toBeObject();
      expect(response.status).toBe(200);
      const rooms = response.data;
      expect(rooms).toBeArray();
      expect(rooms.length > 0).toBeTrue();
      expect(rooms).toSatisfyAll(isRoom);

      room = head(rooms);
      done();
    } catch(err) {
      done(err);
    }
  });

  test('should get all messages from room', async(done) => {
    try {
      const response = await agent.get(`api/rooms/${room.id}/messages`);
      expect(response).toBeObject();
      expect(response.status).toBe(200);
      const messages = response.data;
      expect(messages).toBeArray();

      if (messages.length > 0) {
        expect(messages).toSatisfyAll(isMessage);
      }
      done();
    } catch(err) {
      done(err);
    }
  })

  test('should send and recieve message', async (done) => {
    const roomSocket = io.connect(`http://[localhost]:3000/${room.id}`, {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true,
      transports: ['websocket'],
    });
    roomSocket.on('connect', async () => {
      expect(roomSocket.connected).toBeTrue();
      let response;
      let start;
      roomSocket.on('new message', (data) => {
        const delay = Date.now() - start;

        expect(data).toBeObject();
        expect(isMessage(data)).toBeTrue();
        expect(data.text).toBe(testMessage);
        expect(data.user.name).toBe(testUser.name);
        expect(delay < 200).toBeTrue();
        done();
      });

      try {
        start = Date.now();
        response = await agent.post('api/messages', {
          text: testMessage,
          roomId: room.id
        });
      } catch (err) {
        done(err);
      }
    });
  });

  test('should have new message', async (done) => {
    const response = await agent.get(`api/rooms/${room.id}/messages`);
    expect(response).toBeObject();
    expect(response.status).toBe(200);
    const messages = response.data;
    expect(messages).toBeArray();

    const newMessage = last(messages);
    expect(newMessage).toBeObject();
    expect(isMessage(newMessage));
    expect(newMessage.text === testMessage).toBeTrue();
    expect(newMessage.user.name === testUser.name).toBeTrue();
    done();
  });

});