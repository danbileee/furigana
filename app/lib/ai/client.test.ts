import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("openaiClient", () => {
  const originalApiKey = process.env["OPENAI_API_KEY"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env["OPENAI_API_KEY"] = originalApiKey;
      return;
    }

    delete process.env["OPENAI_API_KEY"];
  });

  describe("when OPENAI_API_KEY is set", () => {
    it("exports an OpenAI instance", async () => {
      process.env["OPENAI_API_KEY"] = "sk-test-key";

      const { openaiClient } = await import("~/lib/ai/client");

      expect(openaiClient).toBeInstanceOf(OpenAI);
    });

    it("exports an instance with the chat and models namespaces", async () => {
      process.env["OPENAI_API_KEY"] = "sk-test-key";

      const { openaiClient } = await import("~/lib/ai/client");

      expect(openaiClient.chat).toBeDefined();
      expect(openaiClient.models).toBeDefined();
    });
  });

  describe("when OPENAI_API_KEY is not set", () => {
    it("throws at import time when the variable is undefined", async () => {
      delete process.env["OPENAI_API_KEY"];

      await expect(import("~/lib/ai/client")).rejects.toThrow("OPENAI_API_KEY");
    });

    it("throws at import time when the variable is an empty string", async () => {
      process.env["OPENAI_API_KEY"] = "";

      await expect(import("~/lib/ai/client")).rejects.toThrow("OPENAI_API_KEY");
    });
  });
});
