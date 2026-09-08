import type { ContextTarget, CoodeConfig, InfoCard, InfoProvider } from "../types.js";

export const rulesProvider: InfoProvider = {
  id: "rules",
  label: "User rules",
  match(_target, config) {
    return config.providers.rules.enabled;
  },
  async fetch(target, { config }) {
    const text = target.text.trim();
    if (!text) {
      return [];
    }

    return config.rules
      .filter((rule) => text.includes(rule.match) || rule.match === text)
      .map((rule, index) => ({
        id: `rules:${rule.match}:${index}`,
        title: rule.title,
        body: rule.body,
        priority: 80,
        source: "rules",
      }));
  },
};
