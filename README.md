# ♥ Tiramisu in JavaScript (Express + SQLite)

티라미수 API 서버의 구조를 JavaScript + SQLite (Database) + Express로 옮겨온 버전입니다.

---

## 📦 기능

* 유저 밴 / 언밴
* 밴 여부 조회
* 전체 밴 목록 조회 (bulk)
* 기간제 밴 지원
* 인게임 서버에 실시간 반영 (MessagingService API)

---

## 🛠️ 설치 방법

### 1. 프로젝트 클론

```bash
git clone https://github.com/samilimik/tiramisu-api.git
cd tiramisu-api
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경 변수 설정 (.env)

파일 내에 있는 `.env` 파일을 다음과 같이 설정해주세요:

```env
ADMIN_SECRET=[암호]
SUPER_SECRET=[쓸모없음]

ROBLOX_API_KEY=[로블록스 클라우드 API 키]
ROBLOX_UNIVERSE_ID=[게임 유니버스 ID]
ROBLOX_TOPIC=ban
```

---

## 🚀 실행

```bash
node server.js
```

위와 같이 서버를 실행하면 3000번 포트가 열립니다:

```
http://localhost:3000
```

---

## 🔐 인증 방식

서버 API 보안 구성에 의해 암호로 보호되어 있는 API는 아래 헤더 중 하나가 필요합니다:

```
X-Shared-Secret: [환경변수에 저장된 암호]
```

또는

```
Authorization: Bearer [환경변수에 저장된 암호]
```

---

## 📡 API 목록

### 🚫 밴

```http
POST /ban/:id
```

#### Body:

```json
{
  "reason": "사유",
  "by": "관리자",
  "days": 7
}
```

#### 설명:

* `days`를 생략하고 POST할 시에는 영구 밴으로 인식하여 처리됩니다.
* 인게임 서버 내에 실시간으로 반영됩니다.

---

### ❌ 언밴

```http
DELETE /ban/:id
```

---

### 🔍 밴 여부 조회

```http
GET /banned/:id
```

---

### 📦 전체 밴 목록

```http
POST /banned/bulk
```

---

## 📂 데이터베이스

SQLite (`bans.db`)는 폴더 내에 자동으로 생성됩니다.

### 테이블 구조

| 컬럼      | 설명               |
| ------- | ---------------- |
| userId  | Roblox User ID   |
| reason  | 밴 사유             |
| by      | 밴 실행자            |
| ts      | 밴 시간 (timestamp) |
| expires | 만료 시간 (없으면 영구)   |

---

## 🔄 인게임 서버 연동

밴, 또는 언밴할시 자동으로 MessagingService API를 통해 인게임 서버에 전송됩니다:

```json
{
  "action": "ban_update",
  "userId": 123456,
  "banned": true
}
```

---

## ⚠️ 주의사항

* 클라우드 API 키는 외부에 노출되면 위험합니다. MessagingService 관련 권한만 넣은 뒤 API 키를 생성하시기 바랍니다.
* 공인IP를 통해 호스팅하는것은 매우 위험합니다. 서버를 HTTPS (개인 도메인) 환경에서 운영하실것을 권장드립니다.

---

## 💡 추천 배포

* Ubuntu 환경의 서버
* Docker
* Vercel (API 분리가 별도로 필요할 수 있습니다)

---

## 🧑‍💻 라이선스

MIT License
