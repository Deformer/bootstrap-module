const io = require('socket.io-client');
const http = require('http');
const axios = require('axios');
const { isString, isNumber, get, head, last } = require('lodash');
require('jest-extended');

let socket;
let authRoomSocket;
let agent;
let room;

const apiServerUrl = 'http://localhost:3000';

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
    baseURL: apiServerUrl,
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
    socket = io.connect(`http://[localhost]:3000`, {
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
        expect(user.login).toBe('serg1');
        expect(user.name).toBe('Sergey Belan');
        expect(data).toBeObject();
        expect(data.message).toBe('User Sergey Belan logged in');


        done();
      });

      response = await agent.post(`api/users/login`, {
        login: 'serg1',
        password: '123456'
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
        expect(data).toBeObject();
        expect(data.message).toBe('Hello World!');
        expect(data.username).toBe('Sergey Belan');
        const delay = Date.now() - start;
        expect(delay < 200).toBeTrue();

        done();
      });

      try {
        start = Date.now();
        response = await agent.post('api/messages', {
          text: "Hello World!",
          roomId: room.id
        });
      } catch (err) {
        done(err);
      }
    });
  })

  test('should have new message', async (done) => {
    const response = await agent.get(`api/rooms/${room.id}/messages`);
    expect(response).toBeObject();
    expect(response.status).toBe(200);
    const messages = response.data;
    expect(messages).toBeArray();

    const newMessage = last(messages);
    expect(newMessage).toBeObject();
    expect(isMessage(newMessage));
    expect(newMessage.text === 'Hello World!').toBeTrue();
    expect(newMessage.user.name === 'Sergey Belan').toBeTrue();
    done();
  })

});