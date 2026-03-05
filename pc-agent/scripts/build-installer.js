/**
 * PC Agent 인스톨러 빌드 스크립트
 *
 * 역할:
 * 1. NestJS 앱 빌드 (nest build)
 * 2. staging 폴더에 필요한 파일만 복사
 * 3. Node.js 포터블 바이너리 다운로드 (없으면)
 * 4. Inno Setup 컴파일 (iscc가 PATH에 있으면)
 *
 * 사용법: node scripts/build-installer.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── 설정 ───────────────────────────────────────────
const ROOT_DIR = path.resolve(__dirname, '..');
const STAGING_DIR = path.join(ROOT_DIR, 'installer', 'staging');
const INSTALLER_DIR = path.join(ROOT_DIR, 'installer');

// 번들할 Node.js 버전 (현재 개발 환경과 일치시켜야 함)
const NODE_VERSION = process.version.replace('v', ''); // 예: "20.19.2"
const NODE_ARCH = process.arch; // "x64"
const NODE_ZIP_NAME = `node-v${NODE_VERSION}-win-${NODE_ARCH}`;
const NODE_DOWNLOAD_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP_NAME}.zip`;

// ─── 유틸리티 ───────────────────────────────────────

/** 콘솔 로그 (단계 표시) */
function log(step, message) {
  console.log(`\n[${'='.repeat(50)}]`);
  console.log(`  [${step}] ${message}`);
  console.log(`[${'='.repeat(50)}]`);
}

/** 폴더 재생성 (기존 내용 삭제) */
function recreateDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

/** 폴더 복사 (재귀) */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 파일 다운로드 (리다이렉트 지원) */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = (currentUrl) => {
      https
        .get(currentUrl, (response) => {
          // 리다이렉트 처리
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            file.close();
            fs.unlinkSync(destPath);
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`다운로드 실패: HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(
            response.headers['content-length'] || '0',
            10,
          );
          let downloaded = 0;

          response.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize > 0) {
              const percent = ((downloaded / totalSize) * 100).toFixed(1);
              process.stdout.write(
                `\r  다운로드 중: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`,
              );
            }
          });

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('\n  다운로드 완료!');
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
    };

    request(url);
  });
}

// ─── 메인 빌드 프로세스 ───────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Claude Code Mobile - 인스톨러 빌드      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Node.js 버전: v${NODE_VERSION} (${NODE_ARCH})`);
  console.log(`  프로젝트 경로: ${ROOT_DIR}`);

  // ── Step 1: NestJS 빌드 ──
  log('1/5', 'NestJS 앱 빌드 중...');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

  // ── Step 2: staging 폴더 준비 ──
  log('2/5', 'staging 폴더 준비 중...');
  recreateDir(STAGING_DIR);

  // dist/ 복사
  const distSrc = path.join(ROOT_DIR, 'dist');
  const distDest = path.join(STAGING_DIR, 'dist');
  console.log('  dist/ 복사 중...');
  copyDir(distSrc, distDest);

  // node_modules/ 복사 (프로덕션 의존성만)
  log('3/5', '프로덕션 의존성 설치 중...');
  // package.json과 package-lock.json 복사 후 npm ci --omit=dev로 프로덕션만 설치
  fs.copyFileSync(
    path.join(ROOT_DIR, 'package.json'),
    path.join(STAGING_DIR, 'package.json'),
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, 'package-lock.json'),
    path.join(STAGING_DIR, 'package-lock.json'),
  );
  execSync('npm ci --omit=dev', {
    cwd: STAGING_DIR,
    stdio: 'inherit',
  });
  // package-lock.json은 설치 후 불필요
  fs.unlinkSync(path.join(STAGING_DIR, 'package-lock.json'));

  // start.bat 복사 (디버그용 유지)
  fs.copyFileSync(
    path.join(INSTALLER_DIR, 'start.bat'),
    path.join(STAGING_DIR, 'start.bat'),
  );

  // start-hidden.vbs 복사 (백그라운드 실행용)
  fs.copyFileSync(
    path.join(INSTALLER_DIR, 'start-hidden.vbs'),
    path.join(STAGING_DIR, 'start-hidden.vbs'),
  );

  // 아이콘 파일 복사
  const assetsSrc = path.join(ROOT_DIR, 'assets');
  const assetsDest = path.join(STAGING_DIR, 'assets');
  if (fs.existsSync(assetsSrc)) {
    console.log('  assets/ 복사 중...');
    copyDir(assetsSrc, assetsDest);
  }

  // ── Step 4: Node.js 포터블 다운로드 ──
  log('4/5', `Node.js v${NODE_VERSION} 포터블 준비 중...`);

  const nodeExeDest = path.join(STAGING_DIR, 'node.exe');
  const nodeZipPath = path.join(INSTALLER_DIR, `${NODE_ZIP_NAME}.zip`);

  if (fs.existsSync(nodeExeDest)) {
    console.log('  node.exe가 이미 존재합니다. 건너뜁니다.');
  } else {
    // 캐시된 zip이 있으면 재사용
    if (!fs.existsSync(nodeZipPath)) {
      console.log(`  다운로드 URL: ${NODE_DOWNLOAD_URL}`);
      await downloadFile(NODE_DOWNLOAD_URL, nodeZipPath);
    } else {
      console.log('  캐시된 zip 파일 사용');
    }

    // zip에서 node.exe만 추출
    console.log('  node.exe 추출 중...');
    const psScriptPath = path.join(INSTALLER_DIR, '_extract-node.ps1');
    try {
      // PowerShell 스크립트를 임시 파일로 저장 후 실행
      // (경로에 한글이 포함되면 인라인 명령이 인코딩 문제로 실패할 수 있음)
      const psScript = [
        'Add-Type -AssemblyName System.IO.Compression.FileSystem',
        `$zip = [System.IO.Compression.ZipFile]::OpenRead("${nodeZipPath.replace(/\\/g, '\\\\')}")`,
        `$entry = $zip.Entries | Where-Object { $_.FullName -eq '${NODE_ZIP_NAME}/node.exe' }`,
        'if ($entry) {',
        `  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, "${nodeExeDest.replace(/\\/g, '\\\\')}", $true)`,
        '  Write-Host "  node.exe 추출 완료!"',
        '} else {',
        '  Write-Host "  오류: zip에서 node.exe를 찾을 수 없습니다."',
        '  exit 1',
        '}',
        '$zip.Dispose()',
      ].join('\n');

      fs.writeFileSync(psScriptPath, psScript, 'utf-8');
      execSync(
        `powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`,
        { stdio: 'inherit' },
      );
      // 임시 스크립트 정리
      fs.unlinkSync(psScriptPath);

      // 추출 결과 검증
      if (!fs.existsSync(nodeExeDest)) {
        throw new Error('PowerShell 추출 후에도 node.exe가 없습니다.');
      }
    } catch (error) {
      // 임시 스크립트 파일이 남아있으면 정리
      if (fs.existsSync(psScriptPath)) {
        fs.unlinkSync(psScriptPath);
      }
      console.error('  node.exe 추출 실패:', error.message);
      console.log('  대안: 현재 시스템의 node.exe를 복사합니다.');
      const systemNode = execSync('where node', { encoding: 'utf-8' })
        .trim()
        .split('\n')[0]
        .trim();
      fs.copyFileSync(systemNode, nodeExeDest);
      console.log(`  시스템 node.exe 복사 완료: ${systemNode}`);
    }
  }

  // ── Step 5: Inno Setup 컴파일 (선택적) ──
  log('5/5', 'Inno Setup 컴파일 확인 중...');

  const issPath = path.join(INSTALLER_DIR, 'setup.iss');
  if (!fs.existsSync(issPath)) {
    console.log(
      '  setup.iss가 없습니다. 인스톨러 스크립트를 먼저 생성해 주세요.',
    );
    console.log('  staging 폴더 준비는 완료되었습니다.');
  } else {
    try {
      // Inno Setup 컴파일러 (iscc.exe) 찾기
      const isccPaths = [
        'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
        'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
      ];

      let isccPath = null;
      for (const p of isccPaths) {
        if (fs.existsSync(p)) {
          isccPath = p;
          break;
        }
      }

      if (isccPath) {
        console.log(`  Inno Setup 발견: ${isccPath}`);
        execSync(`"${isccPath}" "${issPath}"`, { stdio: 'inherit' });
        console.log('  인스톨러 생성 완료!');
      } else {
        console.log('  Inno Setup이 설치되어 있지 않습니다.');
        console.log(
          '  https://jrsoftware.org/isinfo.php 에서 설치 후 다시 실행해 주세요.',
        );
        console.log(
          '  staging 폴더는 준비되었으므로 수동으로 ISCC.exe setup.iss 실행 가능합니다.',
        );
      }
    } catch (error) {
      console.error('  Inno Setup 컴파일 실패:', error.message);
    }
  }

  // ── 완료 ──
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  빌드 완료!                               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  staging 폴더: installer/staging/         ║`);
  console.log('╚══════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\n빌드 실패:', err);
  process.exit(1);
});
