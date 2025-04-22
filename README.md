# Customer Support System

통합된 GPT 기반 고객 상담 서비스입니다.  
MySQL–MCP, Qdrant–RAG, GPT 백엔드, React 웹챗 & Admin UI, n8n 워크플로우까지 포함합니다.

---

## 🚀 실행 가이드

### 1. 준비 사항
- Docker & Docker Compose 설치
- 프로젝트 루트에 `secrets/` 폴더 생성 및 시크릿 파일 복사:
  ```
  secrets/
    ├─ api_key              # exampleapikey
    ├─ openai_key           # sk-...
    ├─ db_root_password     # example
    ├─ smtp_pass            # smtppassword
    ├─ telegram_token       # 123456:ABC...
    └─ telegram_chat_id     # 987654321
  ```
- `.gitignore` 에 `secrets/`, `**/*.bak`, `node_modules/` 추가

### 2. 전체 서비스 시작
```bash
# 프로젝트 루트
docker-compose up -d --build
```
- MySQL (3306), Qdrant (6333)  
- MCP 서버 (3000)  
- RAG 서버 (5050)  
- GPT 백엔드 (4000)  
- n8n 워크플로우 (5678)  
- React 클라이언트 & Nginx (3001)  

### 3. 웹 UI 접속
- **고객 웹챗:** http://localhost:3001  
- **Admin 패널:** http://localhost:3001/admin.html  

---

## 📁 폴더 구조

```
/
├─ docker-compose.yml
├─ secrets/                         # Docker Secrets
│   ├─ api_key
│   ├─ openai_key
│   ├─ db_root_password
│   ├─ smtp_pass
│   ├─ telegram_token
│   └─ telegram_chat_id
│
├─ mcp/                             # MySQL + Express API
│   ├─ init.sql                     # 초기 스키마 및 예시 데이터
│   ├─ server.js                    # /api/orders, /api/tickets
│   ├─ .env                         # ENV 설정
│   ├─ package.json
│   └─ Dockerfile
│
├─ rag_server/                      # FastAPI + Qdrant RAG 서버
│   ├─ *.txt                        # FAQ, 정책 문서
│   ├─ main.py                      # /rag-search
│   ├─ requirements.txt
│   ├─ .env
│   └─ Dockerfile
│
├─ backend/                         # GPT Tool 처리 백엔드
│   ├─ server.js                    # /chat, /metrics, /healthz
│   ├─ .env                         # ENV 설정
│   ├─ package.json
│   └─ Dockerfile
│
├─ client/                          # React + Nginx
│   ├─ Dockerfile
│   ├─ package.json
│   ├─ public/
│   │   ├─ index.html               # React 루트
│   │   └─ admin.html               # 티켓 관리 UI
│   └─ src/
│       ├─ index.js
│       ├─ App.js
│       └─ App.css
│
└─ n8n/                             # n8n 워크플로우 정의
    └─ assign_tickets_workflow.json
```

---

## 🔌 API 스펙

### 1. MCP 서버 (포트 3000)

#### GET `/api/orders?customer_id=<id>`
- 고객 주문 내역 조회  
- **Query**: `customer_id` (integer)  
- **Response**:
  ```json
  { "orders": [ { "order_id":1, "product_name":"...", "order_date":"YYYY-MM-DD" }, … ] }
  ```

#### GET `/api/tickets`
- 모든 티켓 리스트  
- **Response**:
  ```json
  { "tickets":[
      { "ticket_id":1, "user_id":"u1", "user_name":"홍길동", "user_phone":"010-xxxx-xxxx",
        "question":"...", "status":"pending", "assigned_to":null, "created_at":"YYYY-MM-DD hh:mm:ss" },
      … 
    ]
  }
  ```

#### PUT `/api/tickets/:id`
- 티켓 상태/담당자 업데이트  
- **Path**: `id` (ticket_id)  
- **Body**: `{ "status":"in_progress"|"completed", "assigned_to":"agent_name" }`  
- **Response**: `{ "message":"Ticket updated" }`

---

### 2. RAG 서버 (포트 5050)

#### POST `/rag-search`
- 벡터 검색 기반 문서 요약  
- **Body**: `{ "query":"질문 텍스트" }`  
- **Response**: `{ "summary":"관련 FAQ 내용
..." }`

---

### 3. GPT 백엔드 (포트 4000)

#### POST `/chat`
- 대화 메시지 → GPT 호출 → 함수/핸들오프 처리  
- **Body**:
  ```json
  {
    "user_id":"u1",
    "user_name":"홍길동",
    "user_phone":"010-1234-5678",
    "messages":[ ... ]
  }
  ```
- **Response**:
  ```json
  { "reply":"GPT 또는 상담원 응답 텍스트" }
  ```

#### GET `/healthz`
- 헬스 체크: `"OK"`

#### GET `/metrics`
- Prometheus 메트릭 노출

---

## 🛠️ 개발/배포 팁

- **개발 모드**:  
  ```bash
  cd client
  npm start   # CRA dev 서버 (3000) → proxy 설정
  ```
- **프로덕션 모드**:  
  ```bash
  docker-compose up -d --build
  ```

---

```
