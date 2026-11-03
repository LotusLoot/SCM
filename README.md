# SCM 사이버 용병단 — 온라인 버전

GitHub Pages가 게임 파일을 보여 주고, Firebase가 로그인·저장·크루·구역 쟁탈전·랭킹을 맡아요.
`firebase-config.js`를 비워 두면 서버 없이 브라우저에만 저장되는 오프라인 모드로 돌아가요.

## 서버로 옮겨 간 기능

| 기능 | 서버에서 하는 일 |
|---|---|
| 로그인 | Google 로그인 또는 게스트(익명) 로그인, 단장 이름. 게스트는 나중에 Google 계정 연결 가능 |
| 저장 | 진행 상황을 계정에 자동 저장 (기기를 바꿔도 이어짐) |
| 하루 | 매일 0시(한국 시간)에 의뢰·공격권·아레나가 채워짐. 미션·상자·의뢰를 모두 끝내면 미션 초기화 가능 (하루 2번) |
| 크루 | 만들기, 가입 신청, 직급(크루장·부크루장·간부·단원), 승인·거절·추방(24시간 재가입 금지), 기여도 순위, 크루 상점, 최대 10명 |
| 구역 쟁탈전 | 12구역을 모든 크루가 실시간으로 함께 봄. 다른 크루 구역을 치면 그 크루원이 등록한 방어 팀과 싸움 |
| 아레나 | 점수가 비슷한 실제 플레이어의 방어 팀과 비동기 대전 (모자라면 AI로 채움) |
| 현상금 사냥 | 크루원이 같은 보스 체력을 함께 깎는 크루 협동 |
| 랭킹 | 아레나 점수, 넷 다이브 최고점, 빌딩 습격 최고 층, 분대 전투력 |
| 도시 소식 | 구역 차지, 새 크루 등장 같은 소식을 모두가 봄 |
| 주간 보상 | 매주 월요일, 지난주 구역 순위로 크레딧·데이터칩·칭호 「도시의 지배자」 |

---

## 1단계. Firebase 프로젝트 만들기

1. <https://console.firebase.google.com> 에 들어가서 **프로젝트 추가**를 눌러요. 이름은 `scm-game`처럼 아무거나 괜찮아요. Google 애널리틱스는 꺼도 돼요.
2. 프로젝트가 만들어지면 홈 화면의 **웹(`</>`) 아이콘**을 눌러 웹 앱을 추가해요. 앱 닉네임은 `scm`. "Firebase 호스팅 설정"은 체크하지 않아요 (GitHub Pages를 쓸 거라서요).

## 2단계. 설정값을 `firebase-config.js`에 붙여 넣기

웹 앱을 만들면 `const firebaseConfig = { apiKey: ..., ... }`가 나와요. 그 중괄호 안의 내용을 `firebase-config.js`에 이렇게 넣어요.

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "scm-game.firebaseapp.com",
  projectId: "scm-game",
  storageBucket: "scm-game.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

맨 아래의 `window.FIREBASE_CONFIG = null;` 줄은 지워요. 이 값들은 웹에 공개돼도 괜찮은 값이에요. 안전은 4단계의 보안 규칙이 지켜 줘요.

## 3단계. 로그인 켜기

**빌드 → Authentication → 시작하기 → 로그인 방법**에서 두 개를 사용 설정해요.

- **Google** (프로젝트 지원 이메일만 고르면 돼요)
- **익명** (게스트로 시작용)

## 4단계. 데이터베이스와 보안 규칙

1. **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)`
   - **프로덕션 모드**로 시작
2. 만들어지면 **규칙** 탭을 열고, 안에 있는 내용을 모두 지운 다음 이 폴더의 `firestore.rules` 내용을 통째로 붙여 넣고 **게시**를 눌러요.

색인(인덱스)은 따로 만들 필요 없어요. 구역 12곳은 처음 접속한 사람이 자동으로 만들어요.

## 5단계. GitHub에 올리고 Pages 켜기

1. <https://github.com/new> 에서 새 저장소를 만들어요. 이름 예시: `scm`. **Public**으로 만들어요 (무료 계정은 Public이어야 Pages가 돼요).
2. 저장소 화면에서 **Add file → Upload files**를 눌러 이 폴더 안의 파일을 **모두** 끌어다 놓아요. `index.html`이 저장소 맨 위에 있어야 해요. 그리고 **Commit changes**.
3. 저장소 **Settings → Pages**에서
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더 **/ (root)** → **Save**
4. 1~2분 기다리면 위쪽에 주소가 떠요: `https://내아이디.github.io/scm/`

> Git을 쓸 줄 알면 이렇게 올려도 돼요.
> ```bash
> git init && git add . && git commit -m "SCM 첫 배포"
> git branch -M main
> git remote add origin https://github.com/내아이디/scm.git
> git push -u origin main
> ```

## 6단계. GitHub 주소를 Firebase에 등록

**Authentication → 설정 → 승인된 도메인 → 도메인 추가**에 `내아이디.github.io`를 넣어요.
이걸 안 하면 Google 로그인에서 "이 주소가 Firebase에 등록되지 않았어요"라는 메시지가 떠요.

끝! 주소를 친구들에게 보내면 같은 도시에서 크루를 만들고 구역을 빼앗을 수 있어요.

---

## 7단계. 실시간 대결 켜기 (Realtime Database)

친구와 1:1로 동시에 싸우는 **실시간 대결**은 Firestore가 아니라 **Realtime Database**를 써요. 안 켜도 나머지는 다 돼요.

1. Firebase 콘솔 → **빌드 → Realtime Database → 데이터베이스 만들기**
2. 위치는 **싱가포르(asia-southeast1)** 를 고르면 한국에서 빨라요. **잠금 모드로 시작** → 사용 설정
3. **데이터** 탭 맨 위에 보이는 주소(`https://scmgame-default-rtdb....`)를 복사해요
4. `firebase-config.js`의 `measurementId` 줄 끝에 쉼표를 붙이고, 그 아래에 한 줄을 넣어요
   `databaseURL: "복사한 주소"`
5. **규칙** 탭의 내용을 모두 지우고 `database.rules.json` 내용을 붙여 넣은 뒤 **게시**

---

## 수정하고 다시 올릴 때

`index.html` 안의 파일 주소 뒤에 `?v=27` 같은 버전 번호가 붙어 있어요. 새 버전을 올릴 때 이 숫자가 바뀌면 브라우저가 예전 파일 대신 새 파일을 받아요.

GitHub 저장소에서 파일을 다시 업로드(같은 이름이면 덮어써요)하면 1~2분 뒤에 반영돼요.
휴대폰에서 바로 안 바뀌면 새로고침을 두세 번 해 보세요.

## 파일 설명

| 파일 | 내용 |
|---|---|
| `index.html` | 게임 화면 틀 |
| `style.css` | 화면 디자인 (남색 패널 · 입체 버튼) |
| `data.js` | 용병·구역·브로커 같은 기획 데이터 |
| `core.js` | 저장, 능력치, 의뢰 생성, 영입 확률 |
| `battle.js` | 액션 전투 (직접 조작 + 동료 자동 전투) |
| `dive.js` | 넷 다이브 미니게임 |
| `progress.js` | 레벨·순찰·메인 작전·시너지·패시브·미션·출석·픽업 데이터 |
| `sfx.js` | 효과음 (파일 없이 합성) |
| `screens.js` | 의뢰·도시·특수 작전 화면 |
| `ui.js` | 본부(로비)·출격·용병·영입 화면, 보상 창 |
| `net.js` | Firebase 온라인 기능 |
| `pvp.js` | 실시간 1:1 대결 (방 코드 · 대기실 · 전투 동기화) |
| `firebase-config.js` | 내 Firebase 설정 (2단계) |
| `firestore.rules` | 데이터베이스 보안 규칙 (4단계) |
| `database.rules.json` | 실시간 대결용 Realtime Database 규칙 (7단계) |
| `imgdata.js` | 용병 그림 (서 있는 그림 + 공격 자세 그림)을 파일 하나에 담은 것 |

## 알아 둘 점

- **무료 요금제(Spark)로 충분해요.** 하루 읽기 5만 번, 쓰기 2만 번까지 무료라 친구들끼리 하기엔 넉넉해요.
- **치트를 완전히 막지는 못해요.** 전투 계산을 각자의 브라우저에서 하기 때문에, 개발자 도구를 쓰면 자기 크레딧이나 점수를 바꿀 수 있어요. 보안 규칙은 남의 데이터 건드리기, 남의 크루 멋대로 바꾸기, 구역 장악도를 한 번에 크게 올리기 같은 건 막아 줘요. 학교 친구들끼리 하는 데는 충분하고, 나중에 진짜 출시하려면 Cloud Functions로 서버에서 전투 결과를 검사해야 해요.
- **게스트 계정**은 브라우저 데이터를 지우면 사라져요. 오래 할 사람은 Google 로그인을 쓰세요.
- 처음 로그인하면 그 기기에서 오프라인으로 하던 진행 상황을 계정으로 옮겨요.
