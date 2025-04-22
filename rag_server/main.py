import sentry_sdk
sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"))

import os
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from langchain.document_loaders import TextLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Qdrant
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()

# ───────────────────────────────────────────────────────────────────────────────
# 필수 환경변수 검증
for var in [
    "API_KEY_FILE",
    "OPENAI_API_KEY_FILE",
    "QDRANT_HOST",
    "QDRANT_PORT"
]:
    if not os.getenv(var):
        raise RuntimeError(f"⛔ Environment variable {var} is required")
# ───────────────────────────────────────────────────────────────────────────────

API_KEY = open(os.getenv("API_KEY_FILE")).read().strip()
OPENAI_API_KEY = open(os.getenv("OPENAI_API_KEY_FILE")).read().strip()

app = FastAPI()

@app.middleware("http")
async def auth(request: Request, call_next):
    if request.headers.get("x-api-key") != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await call_next(request)

client = QdrantClient(host=os.getenv("QDRANT_HOST","localhost"), port=int(os.getenv("QDRANT_PORT",6333)))
emb = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
vectorstore = Qdrant(client=client, collection_name="faq", embeddings=emb)

@app.on_event("startup")
def load_docs():
    for fname in ["faq.txt","policy.txt","refund.txt","company_policy.txt"]:
        docs = TextLoader(fname, encoding="utf-8").load_and_split()
        vectorstore.add_documents(docs)
    print("Documents ingested.")

class Query(BaseModel):
    query: str

@app.post("/rag-search")
def rag_search(body: Query):
    results = vectorstore.similarity_search(body.query, k=3)
    if not results:
        raise HTTPException(status_code=404, detail="No docs")
    summary = "\n".join(d.page_content for d in results)
    return {"summary": summary}
	
@app.get("/healthz")
async def health(): return "OK"	
