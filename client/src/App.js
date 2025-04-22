import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(
        'http://localhost:4000/chat',
        {
          user_id: 'user123',
          user_name: '홍길동',
          user_phone: '010-1234-5678',
          messages: updated
        },
        {
          headers: { 'x-api-key': 'exampleapikey' }
        }
      );
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: '오류 발생' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = e => {
    if (e.key === 'Enter' && !loading) {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <h2>GPT 고객 상담 챗봇</h2>
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <span className="label">{msg.role === 'user' ? '나:' : 'GPT:'}</span>
            <span className="content">{msg.content}</span>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <span className="label">GPT:</span> <em>응답 생성 중...</em>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="input-area">
        <input
          type="text"
          placeholder="문의 내용을 입력하세요"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          전송
        </button>
      </div>
    </div>
  );
}

export default App;
