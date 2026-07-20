import { createContext, useContext, useState } from "react";
import React from "react";

export type Lang = "en" | "ru";

const LS_KEY = "landing-lang";

export const t = {
  en: {
    pricing: "Pricing",
    signIn: "Sign in",
    requestAccess: "Request Access",
    heroLine1: "The inbox is chaos.",
    heroLine2: "We make it a pipeline.",
    heroSub: "Lemlist reply comes in → Claude AI drafts the perfect response → your Slack approves it — before you even open your inbox.",
    getEarlyAccess: "Get Early Access",
    seeHowItWorks: "See how it works",
    howItWorks: "How it works",
    howItWorksSub: "Three steps from reply to sent — zero manual drafting.",
    step1: "Reply detected",
    step2: "AI drafting",
    step3: "Slack approval",
    step4: "Sent",
    features: "Built for operators",
    featuresSub: "Everything you need to run AI-powered outbound at scale.",
    pricing_section: "Simple pricing",
    pricingSub: "Start free, scale as you grow.",
    requirements: "Requirements",
    requirementsSub: "You need an active Lemlist account + a Slack workspace. That's it.",
    faq: "Frequently asked questions",
    earlyAccess: "Request early access",
    earlyAccessSub: "Join the waitlist and get access when we launch.",
    yourEmail: "your@email.com",
    getAccess: "Get access",
    footer: "AI-powered B2B reply automation.",
    footerRights: "All rights reserved.",
  },
  ru: {
    pricing: "Цены",
    signIn: "Войти",
    requestAccess: "Получить доступ",
    heroLine1: "Входящие — хаос.",
    heroLine2: "Мы делаем из них конвейер.",
    heroSub: "Ответ в Lemlist → Claude AI составляет идеальный черновик → ваш Slack подтверждает — до того, как вы откроете почту.",
    getEarlyAccess: "Ранний доступ",
    seeHowItWorks: "Как это работает",
    howItWorks: "Как это работает",
    howItWorksSub: "Три шага от ответа до отправки — без ручного написания.",
    step1: "Ответ обнаружен",
    step2: "ИИ составляет черновик",
    step3: "Апрув в Slack",
    step4: "Отправлено",
    features: "Для операторов",
    featuresSub: "Всё необходимое для AI-аутбаунда в масштабе.",
    pricing_section: "Простые цены",
    pricingSub: "Начни бесплатно, расти дальше.",
    requirements: "Требования",
    requirementsSub: "Нужен активный Lemlist + Slack-воркспейс. Всё.",
    faq: "Частые вопросы",
    earlyAccess: "Запрос раннего доступа",
    earlyAccessSub: "Вступите в список ожидания и получите доступ при запуске.",
    yourEmail: "ваш@email.com",
    getAccess: "Получить доступ",
    footer: "AI-автоматизация B2B-переписки.",
    footerRights: "Все права защищены.",
  },
} as const;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: typeof t.en;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  tr: t.en,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved === "en" || saved === "ru") return saved;
    } catch {}
    return "en";
  });

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch {}
  }

  return (
    <LangContext.Provider value={{ lang, setLang, tr: t[lang] as typeof t.en }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
