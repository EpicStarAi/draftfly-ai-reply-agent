import { createContext, useContext, useState } from "react";
import React from "react";

export type Lang = "en" | "ru";

const LS_KEY = "draftfly-lang";

export const t = {
  en: {
    overview: "Overview",
    clients: "Clients",
    personas: "Personas",
    campaigns: "Campaigns",
    draftReplies: "Draft Replies",
    replyHistory: "Reply History",
    slackApproval: "Slack Approval",
    internal: "Internal",
    testFlow: "Test Flow",
    clientOnboarding: "Client Onboarding",
    internalSetup: "Internal Setup",
    settings: "Settings",
    theme: "Theme",
    language: "Language",
  },
  ru: {
    overview: "Обзор",
    clients: "Клиенты",
    personas: "Персоны",
    campaigns: "Кампании",
    draftReplies: "Черновики",
    replyHistory: "История",
    slackApproval: "Апрув Slack",
    internal: "Внутреннее",
    testFlow: "Тест потока",
    clientOnboarding: "Онбординг",
    internalSetup: "Настройка",
    settings: "Настройки",
    theme: "Тема",
    language: "Язык",
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
