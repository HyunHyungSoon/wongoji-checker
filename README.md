# 원고지 첨삭 도우미

한국어 교사를 위한 macOS 데스크톱 앱. 학생 글을 Claude API로 첨삭하고, TOPIK 주관식 답란 스타일 원고지 위에 빨간 교정 기호로 표시하여 PDF/PNG로 내보냅니다.

## 기술 스택
- Electron + electron-vite
- React 18 + TypeScript
- Tailwind CSS
- @anthropic-ai/sdk (claude-sonnet-4-6)
- diff-match-patch (교정 ↔ 원고지 동기화)
- jsPDF + SVG 래스터화 (내보내기)
- electron-store (API 키 저장)

## 개발

```bash
cd wongoji-checker
npm install
npm run dev
```

처음 실행하면 우측 상단 ⚙ 설정에서 Anthropic API 키를 입력하세요. 키는 `electron-store`로 이 컴퓨터에만 저장되며 외부로 전송되지 않습니다.

## 빌드 / 패키징

```bash
npm run build      # 번들만
npm run dist       # macOS dmg 생성
npm run typecheck  # 타입 검사
```

## 구조
- `src/main/` — Electron 메인 프로세스 (창 생성, IPC: 첨삭 호출 / 키 저장 / 파일 저장)
- `src/preload/` — contextBridge로 `window.api` 노출
- `src/renderer/` — React 앱
  - `components/ManuscriptGrid.tsx` — 원고지 SVG 렌더러
  - `components/CorrectionList.tsx` — 첨삭 목록
  - `components/TeacherEditor.tsx` — 교사 수정 textarea (300ms 디바운스)
  - `components/SettingsModal.tsx` — API 키 설정
  - `hooks/useProofreading.ts` — API 호출 + JSON 파싱
  - `hooks/useDiff.ts` — 문자 단위 diff → 원고지 셀
  - `utils/export.ts` — SVG → 2x 캔버스 → PNG/PDF

## 동작
1. 좌측 패널에 학생 글 붙여넣기 → **AI 첨삭 실행**
2. 가운데 원고지에 교정 기호 표시 (취소선=삭제, 빨간글자=교체, ∧=삽입, ∨=띄어쓰기)
3. 우측에서 교정 텍스트를 직접 수정하면 원고지에 즉시 반영
4. 상단 **이미지 저장 / PDF 저장**으로 내보내기

> 학생 텍스트는 세션 내에서만 사용되며 앱 외부에 저장되지 않습니다.

## 웹 버전 (다른 선생님과 공유)

같은 React 화면을 **정적 웹사이트**로 빌드해 GitHub Pages에 올릴 수 있습니다.
다른 선생님은 설치 없이 브라우저 주소만으로 사용합니다. 모든 처리(diff·PDF·PNG)가
브라우저에서 돌아가므로 서버가 필요 없고, 학생 글도 서버로 전송되지 않습니다.

```bash
npm run dev:web      # 로컬 개발 서버
npm run build:web    # 정적 빌드 → dist-web/
npm run preview:web  # 빌드 결과 미리보기
```

- Electron 창에서는 네이티브 저장 창으로, 브라우저에서는 일반 다운로드로 저장됩니다
  (`src/renderer/utils/export.ts`가 `window.api` 유무로 자동 분기).
- 폰트 스택에 맥(Apple SD Gothic Neo)·윈도우(Malgun Gothic)를 모두 넣어 두어
  선생님들의 OS와 무관하게 한글이 제대로 보입니다.

### GitHub Pages 배포

1. 이 폴더를 GitHub 저장소에 올립니다 (main 브랜치).
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
3. 이후 main에 푸시할 때마다 `.github/workflows/deploy.yml`이 자동으로 빌드·배포합니다.
4. 배포 주소: `https://<GitHub 사용자명>.github.io/<저장소 이름>/`
   - 다른 선생님에게는 이 주소만 공유하면 됩니다.

> GitHub Pages는 무료 요금제에서 **공개(public) 저장소**여야 동작합니다.
> 코드는 공개되지만 학생 데이터가 코드에 포함되지는 않습니다.
