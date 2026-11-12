# NAS에 Hohub ERP + AI 어시스턴트 설치하기

NAS의 PostgreSQL(Hohub 스키마)에 연결된 Hohub ERP와 AI 어시스턴트를 NAS의 Docker로 실행합니다.
설치 후에는 VPN에 접속한 PC의 브라우저에서 `http://<NAS-IP>:5080`으로 엽니다.

```
[VPN 사용자 브라우저] ──▶ NAS :5080  Hohub 컨테이너 (화면 + API + AI)
                                         ├──▶ NAS PostgreSQL (127.0.0.1:5432, 로그인 계정 포함)
                                         └──▶ Claude API (api.anthropic.com, HTTPS)
```

## 준비물

| 항목 | 설명 |
|---|---|
| Docker | Synology는 **Container Manager**, QNAP은 **Container Station**. SSH 접속이 가능해야 합니다. |
| PostgreSQL | Hohub 스키마(`database/schema.sql`)와 로그인 마이그레이션(`database/migrations/001_login.sql`)이 적용된 DB. NAS에서 `127.0.0.1:5432`로 접속 가능해야 합니다. |
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
| `INTERNAL_API_PORT` | AI 어시스턴트 전용 읽기 API 포트(기본 `5081`). NAS 안(127.0.0.1)에서만 열리므로 공유기에 열 필요가 없습니다 |

`.env`에는 비밀번호와 키가 들어 있으니 다른 사람과 공유하거나 GitHub에 올리지 마세요.

## 4. 로그인 준비 (DB)

DB에 로그인용 열과 세션 표를 추가합니다. 여러 번 실행해도 안전합니다.

```bash
psql "postgres://<DB사용자>:<비밀번호>@127.0.0.1:5432/<DB이름>" -f database/migrations/001_login.sql
```

새 DB라면 먼저 `database/schema.sql`을 적용한 뒤 위 명령을 실행합니다.

## 5. 실행

```bash
sudo docker compose up -d --build
```

첫 빌드는 몇 분 걸립니다. 토큰이 잘못되었으면 빌드가
`ERROR: plus-erp-ai-client was not installed`로 멈추니 1단계 권한을 확인하세요.

## 6. 로그인 계정 만들기

컨테이너 안에서 계정을 만듭니다. 비밀번호(12자 이상)는 입력할 때 화면에 보이지 않습니다.

```bash
sudo docker exec -it hohub-erp npm run user -- add admin --name "관리자" --email admin@회사.com --role ADMIN
sudo docker exec -it hohub-erp npm run user -- add kim --name "김민준" --email kim@회사.com --role VIEWER
sudo docker exec -it hohub-erp npm run user -- disable kim     # 퇴사자 등 (enable로 되돌림)
```

| 역할 | 할 수 있는 일 |
|---|---|
| `ADMIN`, `ACCOUNTANT` | 조회 + 계정과목·송장·예산 등록, AI 어시스턴트 |
| `APPROVER`, `VIEWER` | 조회, AI 어시스턴트 |

같은 아이디로 `add`를 다시 실행하면 비밀번호가 바뀌고 그 사람의 로그인이 모두 끊깁니다.
`schema.sql`의 예시 계정(admin, accountant, approver)은 비밀번호가 없어 `add`로 비밀번호를 정하기 전에는 로그인할 수 없습니다.

## 7. 확인

```bash
curl http://127.0.0.1:5080/api/health      # "database":"connected" 여야 함
curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5080/api/accounts   # 401 (로그인 필요) 여야 함
sudo docker logs hohub-erp                  # "AI assistant enabled" 로그 확인
```

VPN에 연결된 PC에서 `http://<NAS-IP>:5080`을 열어 6단계에서 만든 계정으로 로그인한 뒤, 아래쪽 **AI Assistant** 패널에서 질문해 보세요.
예: "현재 현금 잔액은?", "미결제 송장 현황 알려줘"

## 업데이트

```bash
cd /volume1/docker/Hohub
git pull
psql "postgres://<DB사용자>:<비밀번호>@127.0.0.1:5432/<DB이름>" -f database/migrations/001_login.sql   # 처음 로그인 기능을 받을 때 (다시 실행해도 안전)
sudo docker compose up -d --build
```

## 보안 주의

- 모든 화면과 API는 로그인한 사람만 쓸 수 있습니다. 비밀번호를 5번 틀리면 15분간 잠기고, 30분 동안 쓰지 않으면 자동 로그아웃됩니다.
- 로그인 화면은 아직 평문 HTTP로 열립니다. 5080 포트를 공유기에서 외부로 포트포워딩하지 말고 사내망·VPN 안에서만 쓰세요. 외부에서 써야 한다면 NAS의 역방향 프록시로 HTTPS를 붙이고 `.env`에 `TRUST_PROXY_HOPS=1`을 넣으세요.
- AI 어시스턴트는 조회만 합니다. 데이터를 쓰거나 지우지 않고, ERP API를 통해서만 데이터를 읽습니다.
- 질문과 조회된 ERP 데이터는 답변을 만들기 위해 Claude API(Anthropic)로 전송됩니다. 회사 정책에 맞는지 확인하세요.
- AI 답변에서는 주민등록번호, 카드번호, 이메일, API 키를 자동으로 가립니다.

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `"database":"memory-mode"` | `.env`의 `DATABASE_URL`이 비었거나 컨테이너가 `.env`를 못 읽음. `docker compose config`로 확인 |
| DB 연결 오류 (`ECONNREFUSED`, `password authentication failed`) | PostgreSQL이 `127.0.0.1:5432`에서 대기하는지, `pg_hba.conf`가 127.0.0.1 접속을 허용하는지, 계정·비밀번호 |
| PostgreSQL도 Docker 컨테이너인 경우 | 그 컨테이너가 5432 포트를 NAS에 게시(`-p 5432:5432`)해야 `127.0.0.1:5432`로 접속됩니다 |
| 로그인하면 "아이디 또는 비밀번호가 올바르지 않습니다" | 6단계 `add`로 비밀번호를 정했는지, 5번 틀려 잠겼는지(15분 뒤 다시 시도) 확인 |
| 로그인 화면에 "로그인을 사용할 수 없습니다" | `.env`의 `DATABASE_URL`이 비었음. 로그인 계정이 DB에 있으므로 반드시 필요합니다 |
| `"enabled":false` | `ANTHROPIC_API_KEY`가 비었거나, 빌드 때 `GITHUB_TOKEN` 없이 빌드됨 → 토큰을 넣고 `--build`로 다시 실행 |
| AI가 "not configured correctly" | Claude API 키가 잘못되었거나 결제·크레딧 설정 확인 |
| 5080 포트 충돌 | `.env`의 `PORT`를 다른 값으로 바꾸고 다시 실행 |
