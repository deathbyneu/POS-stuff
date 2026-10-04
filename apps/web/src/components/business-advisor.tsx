"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { api, Dashboard, money, mutate } from "@/lib/api";

type Message = { role: "user" | "assistant"; text: string };

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function trendText(data: Dashboard) {
  const values = data.chart.map((day) => day.revenue);
  const recent = sum(values.slice(-3));
  const previous = sum(values.slice(-6, -3));
  if (!previous && !recent) return "Chưa có đủ doanh thu để xác định xu hướng.";
  if (!previous)
    return `Ba ngày gần nhất phát sinh ${money(recent)} doanh thu; chưa có kỳ trước để so sánh.`;
  const change = Math.round(((recent - previous) / previous) * 100);
  return `Doanh thu 3 ngày gần nhất là ${money(recent)}, ${change >= 0 ? "tăng" : "giảm"} ${Math.abs(change)}% so với 3 ngày liền trước.`;
}

function BusinessAdvisor({
  data,
  close,
}: {
  data: Dashboard;
  close: () => void;
}) {
  const welcome = useMemo(
    () =>
      `Tôi đã đọc số liệu 7 ngày: ${data.ordersCount} đơn, ${money(data.revenue)} doanh thu và ${data.lowStock.length} mặt hàng cần chú ý. Bạn muốn xem vấn đề nào?`,
    [data],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const quick = [
    "Tồn kho nào cần nhập?",
    "Lô nào sắp hết hạn?",
    "Doanh thu đang tăng hay giảm?",
    "Sản phẩm nào bán chạy?",
    "Gợi ý việc cần ưu tiên",
  ];
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, asking]);
  async function ask(text: string) {
    const value = text.trim();
    if (!value || asking) return;
    const history = [
      ...messages,
      { role: "user" as const, text: value },
    ].slice(-11);
    setMessages(history);
    setQuestion("");
    setError("");
    setAsking(true);
    try {
      const result = await mutate<{ answer: string }>("/advisor/chat", {
        messages: history,
        dashboard: data,
      });
      setMessages([...history, { role: "assistant", text: result.answer }]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể nhận câu trả lời từ Gemini.",
      );
    } finally {
      setAsking(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    ask(question);
  }
  return (
    <section className="business-advisor">
      <div className="advisor-head">
        <div className="advisor-icon">
          <Bot size={22} />
        </div>
        <div>
          <h2>Cố vấn kinh doanh</h2>
          <p>Phân tích trực tiếp từ dữ liệu bán hàng và tồn kho</p>
        </div>
        <span className="advisor-private">
          <Sparkles size={13} /> Gemini AI
        </span>
        <button
          type="button"
          className="advisor-close"
          onClick={close}
          aria-label="Đóng cố vấn kinh doanh"
        >
          <X size={18} />
        </button>
      </div>
      <div className="advisor-body">
        <div className="advisor-summary">
          <TrendingUp size={20} />
          <span>{trendText(data)}</span>
          <strong>Biên gộp {data.grossMargin}%</strong>
        </div>
        <div className="advisor-chat" aria-live="polite" ref={chatRef}>
          <div className="advisor-message assistant">
            <Bot size={16} />
            <p>{welcome}</p>
          </div>
          {messages.map((message, index) => (
            <div key={index} className={`advisor-message ${message.role}`}>
              {message.role === "assistant" && <Bot size={16} />}
              <p>{message.text}</p>
            </div>
          ))}
          {asking && (
            <div className="advisor-message assistant loading">
              <Bot size={16} />
              <p>Gemini đang phân tích…</p>
            </div>
          )}
        </div>
        {error && <div className="advisor-error">{error}</div>}
        <div className="advisor-quick">
          {quick.map((item) => (
            <button key={item} onClick={() => ask(item)} disabled={asking}>
              <Lightbulb size={13} />
              {item}
            </button>
          ))}
        </div>
        <form className="advisor-input" onSubmit={submit}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Hỏi về doanh thu, lợi nhuận, tồn kho…"
            maxLength={240}
          />
          <button
            className="button primary"
            disabled={!question.trim() || asking}
            aria-label="Gửi câu hỏi"
          >
            <Send size={17} />
          </button>
        </form>
        <small className="advisor-note">
          Câu hỏi và số liệu tổng hợp trên dashboard được gửi tới Google Gemini.
          Nội dung chỉ mang tính tham khảo, không phải dự báo tài chính.
        </small>
      </div>
    </section>
  );
}

export function BusinessAdvisorWidget() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      setData(await api<Dashboard>("/dashboard"));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải dữ liệu kinh doanh.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !data && !loading) loadDashboard();
  }, [open]);

  return (
    <div className="advisor-widget">
      {open && (
        <div className="advisor-widget-panel" role="dialog" aria-modal="false">
          {data ? (
            <BusinessAdvisor data={data} close={() => setOpen(false)} />
          ) : (
            <div className="advisor-widget-state">
              <div className="advisor-state-icon">
                <Bot size={24} />
              </div>
              {loading ? (
                <>
                  <strong>Đang đọc dữ liệu cửa hàng…</strong>
                  <span>Chỉ mất vài giây.</span>
                </>
              ) : (
                <>
                  <strong>Chưa thể mở cố vấn</strong>
                  <span>{error}</span>
                  <button className="button secondary" onClick={loadDashboard}>
                    <RefreshCw size={15} /> Thử lại
                  </button>
                </>
              )}
              <button
                className="advisor-state-close"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={`advisor-widget-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Đóng cố vấn kinh doanh" : "Mở cố vấn kinh doanh"}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
        {!open && <span className="advisor-widget-dot" />}
      </button>
      {!open && <span className="advisor-widget-label">Cố vấn kinh doanh</span>}
    </div>
  );
}
