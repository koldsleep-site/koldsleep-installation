# koldsleep Archive — Notion live connection

2026-10-09 · v3.9 디자인 유지 / Notion API 자동 연동판

## 구성

- `public/index.html` — 흰 정사각형, 픽셀 고양이, 브랜드 글자 1초 랜덤 변화 및 기존 모든 레이아웃. 노션 갱신 시 새로고침 없이 반영하도록 5분 주기 폴링 추가.
- `src/index.js` — Notion API 서버 측 조회, 하위 블록 재귀 조회, 5분 캐시, 이미지 제공 API.
- `wrangler.jsonc` — Cloudflare Workers 정적 애셋 배포 구성 및 노션 페이지 ID.
- `.gitignore` — 인증 정보와 임시 빌드물 제외.

## 이미 진행된 단계

- `koldsleep-site/koldsleep-installation` GitHub 저장소에 다른 페이지를 변경하지 않고 `archive/index.html`, `archive/worker.js`를 신규 추가함.
- Cloudflare 계정에 새 Worker `koldsleep-archive` 배포 및 `workers.dev` 테스트 도메인 활성화 및 `archive.koldsleep.com` 사용자 지정 도메인 매핑.
- `NOTION_PAGE_ID`는 올바르게 설정됨: `3e9875c0f5d880339306ffd41acc4e42`.

**중요:** Notion 인증 키 `NOTION_TOKEN`은 아직 Cloudflare에 존재하지 않으며, API 동기화는 활성화되지 않은 상태다. 사용자 본인만 발급·등록 가능. 이 프로젝트는 공개 페이지 내용을 미리보기용 스냅샷으로 대체 표시한다.

## 활성화 — 사용자에게 필요한 최초 1회 설정

1. Notion의 `Settings → Connections`에서 Developer Mode를 켜고 새 내부 연결을 생성한다. 연결명 예시: `koldsleep Archive Reader`. **Read content만 허용**한다.
2. 현재 노션 원본 `koldsleep Archive` 페이지의 `••• → Add connections`에서 위 연결을 선택한다. 페이지 내부의 파일 및 첨부파일도 조회할 수 있어야 한다.
3. [Cloudflare Worker 설정](https://dash.cloudflare.com/01ac4b3f6127621c532da13c68e191e5/workers/services/view/koldsleep-archive/production/settings) → `Settings` → `Variables and Secrets` → `Add` → `Secret`을 선택한다. 이름은 정확히 `NOTION_TOKEN`, 값은 노션 내부 연결 토큰을 입력하고 **Deploy**한다. **이 토큰을 채팅이나 GitHub에 게시하지 않는다.**
4. `https://koldsleep-archive.koldsleep.workers.dev/api/status`에서 `"connected":true` 확인. 이어서 `/api/archive`가 JSON 배열 `blocks`를 반환하는지 확인한다.
5. 공개 사이트는 `https://archive.koldsleep.com/` (사용자 지정 도메인 연결 완료). 보조 테스트 주소는 `https://koldsleep-archive.koldsleep.workers.dev/`이다. 신규 DNS·인증서가 전파되는 동안 접속까지 다소 시간이 걸릴 수 있다.

## 동작 검증 및 특이사항

- 프런트엔드와 API는 동일 Cloudflare Worker 도메인을 사용해 CORS 문제가 없다.
- API는 Cloudflare 캐시에 약 5분간 저장된다. 방문 시 즉시 확인하고, 열어 둔 화면은 5분마다 새 데이터를 조회한다. 백그라운드 탭에서는 복귀 시 확인한다.
- 실시간 즉시 반영은 아니다. 노션의 중첩 페이지 하위 콘텐츠가 바뀌었어도 부모 페이지에서 별도 구조 변경이 없다면 제목 등은 갱신되지 않을 수 있다.
- 기존 원본 고양이 사진 블록 ID는 `3ef875c0-f5d8-80b4-bf0c-fcace0bb3121`이며 `/api/rude-nerd-read-cat`으로 제공한다.
- 새로 추가한 **일반 Notion 문단, 프로젝트 링크, 공범자 이름/토글** 등은 변환할 수 있다. 노션 버튼·데이터베이스 등 특수 블록은 별도 매핑이 필요하며, 전체 노션 UI 1:1 렌더링을 지원하지 않는다.
- API 연결이 중단되면 마지막으로 파일에 저장한 스냅샷을 표시하여 사이트가 빈 화면이 되지 않게 했다. 이 경우 최신성이 보장되지는 않는다.

## 별도 계정에서 재배포

```bash
npm install
npx wrangler login
npx wrangler secret put NOTION_TOKEN
npx wrangler deploy
```

`.dev.vars`에 토큰을 넣었다면 `.gitignore`로 인해 저장소에 올라가지 않는다. `wrangler.jsonc`에는 `NOTION_PAGE_ID`만 평문으로 설정되어 있다.

## 보안

API 토큰은 Cloudflare Secret에만 저장하며 브라우저·GitHub 파일에 절대 포함하지 않는다. API는 읽기 전용 노션 통합을 사용한다. 테스트 도메인에서 접근 가능한 콘텐츠는 공개 아카이브에 배치한 내용이다.

## 확인 상태 (2026-10-09)

Cloudflare API에서 `koldsleep-archive` Worker 100% 배포, `archive.koldsleep.com` Worker 연결, DNS AAAA 프록시 확인. 외부 브라우저를 통한 실제 접속 검증은 도구에서 차단되어 확인되지 않았다. `NOTION_TOKEN` 미등록으로 최신 노션 내용 반영 여부는 아직 실제 인증 테스트를 할 수 없다.