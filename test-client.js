/**
 * WebSocket 테스트 클라이언트
 *
 * 이 파일은 PC Agent 서버의 WebSocket 연결을 테스트하기 위한 파일이에요.
 * 실행 방법: node test-client.js
 */

// 1. socket.io-client에서 io 함수를 가져와요
const { io } = require('socket.io-client');

// 2. 서버에 연결해요 (포트 3000 - HTTP 서버와 동일)
const socket = io('http://localhost:3000');

// 3. 'connect' 이벤트: 서버에 연결되면 실행돼요
socket.on('connect', () => {
  console.log('✅ 서버에 연결됨!');
  console.log('   내 소켓 ID:', socket.id);
  console.log('');

  // 연결되면 ping을 보내요
  console.log('📤 ping 이벤트 전송 중...');
  socket.emit('ping');
});

// 4. 'pong' 이벤트: 서버에서 pong 응답이 오면 실행돼요
socket.on('pong', (data) => {
  console.log('📥 pong 응답 받음!');
  console.log('   데이터:', data);
  console.log('   서버 시간:', new Date(data.timestamp).toLocaleString());
  console.log('');

  // 테스트 완료 후 연결 종료
  console.log('🔌 연결 종료 중...');
  socket.disconnect();
});

// 5. 'disconnect' 이벤트: 연결이 끊어지면 실행돼요
socket.on('disconnect', () => {
  console.log('❌ 서버와 연결 해제됨');
  console.log('');
  console.log('✨ 테스트 완료!');
});

// 6. 'connect_error' 이벤트: 연결 실패하면 실행돼요
socket.on('connect_error', (error) => {
  console.log('⚠️ 연결 실패!');
  console.log('   서버가 실행 중인지 확인하세요.');
  console.log('   npm run start:dev 로 서버를 먼저 실행해주세요.');
  console.log('');
  console.log('   에러:', error.message);
  process.exit(1);
});
