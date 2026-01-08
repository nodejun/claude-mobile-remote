/**
 * WebSocket 테스트 클라이언트 - 세션 기능 테스트
 *
 * 실행 방법: node test-client.js
 */

const { io } = require('socket.io-client');
const readline = require('readline');

const socket = io('http://localhost:3000');

// 연결 성공
socket.on('connect', () => {
  console.log('✅ 연결됨! Socket ID:', socket.id);
  showMenu();
});

// 응답 청크 수신
socket.on('response_chunk', (data) => {
  process.stdout.write(data.text);
});

// 응답 완료
socket.on('response_complete', (data) => {
  console.log('\n🔚 응답 완료, exit code:', data.exitCode);
  showMenu();
});

// 에러
socket.on('error', (data) => {
  console.log('❌ 에러:', data.message);
});

// 연결 해제
socket.on('disconnect', () => {
  console.log('🔌 연결 해제됨');
});

// 연결 에러
socket.on('connect_error', (error) => {
  console.log('⚠️ 연결 실패! 서버가 실행 중인지 확인하세요.');
  console.log('   npm run start:dev 로 서버를 먼저 실행해주세요.');
  process.exit(1);
});

// pong 응답 (ping에 대한 응답)
socket.on('pong', (data) => {
  console.log('📥 pong 응답:', JSON.stringify(data, null, 2));
});

// cancelled 응답
socket.on('cancelled', (data) => {
  console.log('📥 cancelled 응답:', JSON.stringify(data, null, 2));
});

// session_ended 응답
socket.on('session_ended', (data) => {
  console.log('📥 session_ended 응답:', JSON.stringify(data, null, 2));
  console.log('   새로운 세션 ID가 발급되었습니다!');
});

function showMenu() {
  console.log('\n--- 테스트 명령어 ---');
  console.log('  1: ping 테스트');
  console.log('  p <메시지>: prompt 전송 (예: p 안녕하세요)');
  console.log('  3: cancel 테스트 (Ctrl+C)');
  console.log('  4: end_session 테스트 (세션 종료)');
  console.log('  q: 종료');
  console.log('--------------------\n');
}

// 키보드 입력 처리
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', (input) => {
  const cmd = input.trim();

  if (cmd === '1') {
    console.log('📤 ping 전송...');
    socket.emit('ping', {});
  } else if (cmd.startsWith('p ')) {
    const message = cmd.substring(2); // 'p ' 이후의 메시지
    console.log(`📤 prompt 전송: "${message}"`);
    console.log('--- Claude 응답 시작 ---');
    socket.emit('prompt', { message });
  } else if (cmd === '3') {
    console.log('📤 cancel 전송 (현재 응답 중단)...');
    socket.emit('cancel', {});
  } else if (cmd === '4') {
    console.log('📤 end_session 전송 (세션 완전 종료)...');
    socket.emit('end_session', {});
  } else if (cmd === 'q') {
    console.log('👋 종료합니다...');
    socket.disconnect();
    process.exit(0);
  } else {
    console.log('알 수 없는 명령어:', cmd);
    showMenu();
  }
});
