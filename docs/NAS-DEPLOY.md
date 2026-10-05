# NAS에 Hohub ERP + AI 어시스턴트 설치하기

NAS의 PostgreSQL(Hohub 스키마)에 연결된 Hohub ERP와 AI 어시스턴트를 NAS의 Docker로 실행합니다.
설치 후에는 VPN에 접속한 PC의 브라우저에서 `http://<NAS-IP>:5080`으로 엽니다.

```
[VPN 사용자 브라우저] ──▶ NAS :5080  Hohub 컨테이너 (화면 + API + AI)
                                         ├──▶ NAS PostgreSQL (127.0.0.1:5432)
                                         └──▶ Claude API (api.anthropic.com, HTTPS)
```

## 준비물

| 항목 | 설명 |
|---|---|
| Docker | Synology는 **Container Manager**, QNAP은 **Container Station**. SSH 접속이 가능해야 합니다. |
| PostgreSQL | Hohub 스키마(`database/schema.sql`)가 적용된 DB. NAS에서 `127.0.0.1:5432`로 접속 가능해야 합니다. |
| Claude API 키 | console.anthropic.com → API Keys에서 발급 (`sk-ant-...`). |
| GitHub 토큰 | AI 클라이언트(비공개 저장소)를 설치할 때만 사용. 아래 1단계 참고. |
| 인터넷 | NAS가 `api.anthropic.com`, `github.com`, `registry.npmjs.org`에 HTTPS로 나갈 수 있어야 합니다. |

## 1. GitHub 토큰 만들기 (읽기 전용)

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → **Generate new token**
2. Repository access: **Only select repositories** → `plushohyun-coder/plus-erp-ai-client`만 선택
3. Permissions → Repository permissions → **Contents: Read-only**
4. 만료일을 정하고 생성한 뒤 토큰을 복사합니다.

토큰은 이미지를 빌드할 때만 쓰이며 이미지 안에 저장되지 않습니다.

## 2. 소스 받기

NAS에 SSH로 접속합니다. 예: Synology는 제어판 → 터미널 및 SNMP → SSH 활성화.

```bash
cd /volume1/docker            # 원하는 폴더
git clone https://github.com/plushohyun-coder/Hohub.git
cd Hohub
```

NAS에 `git`이 없으면 GitHub에서 ZIP으로 내려받아 같은 폴더에 풀어도 됩니다.

## 3. 설정 파일 만들기

```bash
cp .env.docker.example .env
vi .env          # 또는 File Station의 텍스트 편집기
```

| 변수 | 값 |
|---|---|
| `PORT` | 웹 포트. Synology DSM이 5000/5001을 쓰므로 기본값은 `5080` |
| `DATABASE_URL` | `postgres://<DB사용자>:<비밀번호>@127.0.0.1:5432/<DB이름>` |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `GITHUB_TOKEN` | 1단계에서 만든 토큰 |

`.env`에는 비밀번호와 키가 들어 있으니 다른 사람과 공유하거나 GitHub에 올리지 마세요.

## 4. 실행

```bash
sudo docker compose up -d --build
```

첫 빌드는 몇 분 걸립니다. 토큰이 잘못되었으면 빌드가
`ERROR: plus-erp-ai-client was not installed`로 멈추니 1단계 권한을 확인하세요.

## 5. 확인

```bash
curl http://127.0.0.1:5080/api/health      # "database":"connected" 여야 함
curl http://127.0.0.1:5080/api/ai/status   # "enabled":true 여야 함
sudo docker logs hohub-erp                  # "AI assistant enabled" 로그 확인
```

VPN에 연결된 PC에서 `http://<NAS-IP>:5080`을 열고 아래쪽 **AI Assistant** 패널에서 질문해 보세요.
예: "현재 현금 잔액은?", "미결제 송장 현황 알려줘"

## 업데이트

```bash
cd /volume1/docker/Hohub
git pull
sudo docker compose up -d --build
```

## 보안 주의

- **Hohub에는 아직 로그인 기능이 없습니다.** 5080 포트를 공유기에서 외부로 포트포워딩하지 말고 사내망·VPN 안에서만 쓰세요.
- AI 어시스턴트는 조회만 합니다. 데이터를 쓰거나 지우지 않고, ERP API를 통해서만 데이터를 읽습니다.
- 질문과 조회된 ERP 데이터는 답변을 만들기 위해 Claude API(Anthropic)로 전송됩니다. 회사 정책에 맞는지 확인하세요.
- AI 답변에서는 주민등록번호, 카드번호, 이메일, API 키를 자동으로 가립니다.

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `"database":"memory-mode"` | `.env`의 `DATABASE_URL`이 비었거나 컨테이너가 `.env`를 못 읽음. `docker compose config`로 확인 |
| DB 연결 오류 (`ECONNREFUSED`, `password authentication failed`) | PostgreSQL이 `127.0.0.1:5432`에서 대기하는지, `pg_hba.conf`가 127.0.0.1 접속을 허용하는지, 계정·비밀번호 |
| PostgreSQL도 Docker 컨테이너인 경우 | 그 컨테이너가 5432 포트를 NAS에 게시(`-p 5432:5432`)해야 `127.0.0.1:5432`로 접속됩니다 |
| `"enabled":false` | `ANTHROPIC_API_KEY`가 비었거나, 빌드 때 `GITHUB_TOKEN` 없이 빌드됨 → 토큰을 넣고 `--build`로 다시 실행 |
| AI가 "not configured correctly" | Claude API 키가 잘못되었거나 결제·크레딧 설정 확인 |
| 5080 포트 충돌 | `.env`의 `PORT`를 다른 값으로 바꾸고 다시 실행 |
