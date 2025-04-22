const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());

require("dotenv").config();
// ───────────────────────────────────────────────────────────────────────────────
// 필수 환경변수 검증
const requiredEnv = [
   "API_KEY_FILE",
   "OPENAI_API_KEY_FILE",
   "RAG_URL",
   "MCP_URL",
   "SMTP_HOST",
   "SMTP_PORT",
   "SMTP_SECURE",
   "SMTP_USER",
   "SMTP_PASS_FILE",
   "TELEGRAM_TOKEN_FILE",
   "TELEGRAM_CHAT_ID_FILE",
   "ADMIN_EMAIL",
   "DB_HOST",
   "DB_USER",
   "DB_PASSWORD_FILE",
   "DB_NAME"
];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`⛔ Missing required ENV: ${key}`);
    process.exit(1);
  }
});
// ───────────────────────────────────────────────────────────────────────────────
const express = require("express");
const axios = require("axios");
const retry = require("axios-retry");
const cors = require("cors");
const Sentiment = require("sentiment");
const client = require("prom-client");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// 감정 분석 인스턴스
const sentiment = new Sentiment();

// Prometheus 메트릭 수집
client.collectDefaultMetrics();
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// 헬스 체크 엔드포인트
app.get("/healthz", (req, res) => res.send("OK"));

// API Key 인증 미들웨어
const API_KEY = fs.readFileSync(process.env.API_KEY_FILE, "utf8").trim();
app.use((req, res, next) => {
  if (req.header("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Axios 재시도 & 타임아웃 설정
retry(axios, { retries: 3, retryDelay: retry.exponentialDelay });
axios.defaults.timeout = 5000;

// MySQL 풀링 설정 (MCP 서버 대신 직접 DB 접근 원하시면 여기서 사용)
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: fs.readFileSync(process.env.DB_PASSWORD_FILE, "utf8").trim(),
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// 노티파이어 설정 (텔레그램, 이메일)
const TELEGRAM_TOKEN = fs.readFileSync(process.env.TELEGRAM_TOKEN_FILE, "utf8").trim();
const TELEGRAM_CHAT_ID = fs.readFileSync(process.env.TELEGRAM_CHAT_ID_FILE, "utf8").trim();
const bot = new TelegramBot(TELEGRAM_TOKEN);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: fs.readFileSync(process.env.SMTP_PASS_FILE, "utf8").trim(),
  },
});

// OpenAI, RAG, MCP 엔드포인트
const OPENAI_KEY = fs.readFileSync(process.env.OPENAI_API_KEY_FILE, "utf8").trim();
const RAG_URL = process.env.RAG_URL;
const MCP_URL = process.env.MCP_URL;

// GPT Function 정의 (주문 조회)
const functions = [
  {
    name: "get_customer_orders",
    description: "고객 주문 내역 조회",
    parameters: {
      type: "object",
      properties: {
        customer_id: { type: "integer" },
      },
      required: ["customer_id"],
    },
  },
];

app.post("/chat", async (req, res) => {
  const { user_id, user_name, user_phone, messages } = req.body;
  const userMsg = messages[messages.length - 1].content;

  // 1) 감정 분석
  const score = sentiment.analyze(userMsg).score;
  const urgent = score < -2;

  // 2) RAG 검색
  let faqSummary = "";
  try {
    const rag = await axios.post(
      `${RAG_URL}/rag-search`,
      { query: userMsg },
      { headers: { "x-api-key": API_KEY } }
    );
    faqSummary = rag.data.summary;
  } catch (e) {
    console.warn("RAG 호출 실패:", e.message);
  }

  // 시스템 메시지 구성
  const systemMsg = {
    role: "system",
    content: `${urgent ? "🚨 긴급 요청\n" : ""}${faqSummary}`,
  };

  // 3) GPT 첫 호출 (Function 자동 선택)
  let first;
  try {
    first = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [systemMsg, ...messages],
        functions,
        function_call: "auto",
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("GPT 첫 호출 오류:", err.message);
    return res
      .status(500)
      .json({ reply: "죄송합니다. 지금 답변이 어렵습니다." });
  }

  const msg = first.data.choices[0].message;

  // 4) 핸들오프(FAQ 없거나 긴급 시)
  if (!msg.function_call && (!faqSummary || urgent)) {
    // 티켓 DB 저장
    await dbPool.query(
      "INSERT INTO tickets (user_id, user_name, user_phone, question) VALUES (?,?,?,?)",
      [user_id, user_name, user_phone, userMsg]
    );

    // 알림
    const notifyText = urgent ? `[긴급] ${userMsg}` : `[문의 접수] ${userMsg}`;
    bot.sendMessage(TELEGRAM_CHAT_ID, notifyText);
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: urgent ? "긴급 상담 요청" : "새 문의 접수",
      text: `User: ${user_id} ${user_name} (${user_phone})\n\n${userMsg}`,
    });

    // 고객 회신
    return res.json({
      reply: "문의가 접수되었습니다. 담당자가 곧 연락드리겠습니다.",
    });
  }

  // 5) Function 호출 처리 (예: get_customer_orders)
  if (msg.function_call) {
    const args = JSON.parse(msg.function_call.arguments);
    let toolResult = null;

    if (msg.function_call.name === "get_customer_orders") {
      // MCP 서버 호출
      const mcpRes = await axios.get(`${MCP_URL}/api/orders`, {
        params: { customer_id: args.customer_id },
        headers: { "x-api-key": API_KEY },
      });
      toolResult = mcpRes.data;
    }

    // 6) GPT 두 번째 호출 (Function 결과 반영)
    const second = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          systemMsg,
          ...messages,
          msg,
          {
            role: "function",
            name: msg.function_call.name,
            content: JSON.stringify(toolResult),
          },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const finalReply = second.data.choices[0].message.content;
    return res.json({ reply: finalReply });
  }

  // 7) 기본 응답
  return res.json({ reply: msg.content });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`GPT backend running on port ${PORT}`));


if (require.main !== module) {
  module.exports = app;  // tests에서 import 가능하도록
}

