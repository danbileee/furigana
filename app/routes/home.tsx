import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { ReadingView } from "~/components/furigana/ReadingView";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { MAX_INPUT_LENGTH } from "~/constants/input";
import { cn } from "~/lib/utils";
import type { FuriganaToken } from "~/schema/furigana";
import { generateFurigana } from "~/services/furigana";
import type { Route } from "./+types/home";

type ActionSuccess = {
  tokens: FuriganaToken[];
};

type ActionError = {
  error: string;
  originalText: string;
};

type ActionData = ActionSuccess | ActionError;

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Furigana Assistant" },
    {
      name: "description",
      content: "Generate AI-powered furigana annotations for Japanese paragraphes",
    },
  ];
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const formData = await request.formData();
  const textEntry = formData.get("text");

  if (typeof textEntry !== "string" || textEntry.length === 0) {
    return { error: "Please enter some Japanese text.", originalText: "" };
  }

  if (textEntry.length > MAX_INPUT_LENGTH) {
    return {
      error: `Text exceeds ${MAX_INPUT_LENGTH.toLocaleString()} character limit.`,
      originalText: textEntry,
    };
  }

  try {
    const tokens = await generateFurigana(textEntry);
    return { tokens };
  } catch (error) {
    console.error("Furigana generation error:", error);
    return { error: GENERIC_SERVER_ERROR, originalText: textEntry };
  }
}

export default function Home() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmitting = navigation.state === "submitting" && navigation.formMethod === "POST";
  const errorMessage =
    actionData !== undefined && "error" in actionData ? actionData.error : undefined;
  const actionOriginalText =
    actionData !== undefined && "originalText" in actionData ? actionData.originalText : "";

  const [text, setText] = useState<string>(actionOriginalText);

  useEffect(() => {
    setText(actionOriginalText);
  }, [actionOriginalText]);

  const charCount = text.length;
  const isAtOrOverLimit = charCount >= MAX_INPUT_LENGTH;
  const isOverLimit = charCount > MAX_INPUT_LENGTH;
  const isSubmitDisabled = charCount === 0 || isOverLimit || isSubmitting;

  if (actionData !== undefined && "tokens" in actionData) {
    return <ReadingView tokens={actionData.tokens} />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Furigana</h1>

      <Form ref={formRef} method="post" className="flex w-full flex-col gap-4">
        <Textarea
          aria-label="Japanese text input"
          name="text"
          placeholder="Paste Japanese text here…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          disabled={isSubmitting}
          maxLength={MAX_INPUT_LENGTH}
          className="min-h-48 resize-y"
        />

        <p
          data-state={isAtOrOverLimit ? "danger" : "default"}
          className={cn(
            "text-right text-sm",
            isAtOrOverLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {charCount.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}
        </p>

        {errorMessage !== undefined && (
          <p role="alert" className="text-destructive text-sm">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={isSubmitDisabled} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              <span role="status" aria-live="polite">
                Generating…
              </span>
            </>
          ) : (
            "Generate Furigana"
          )}
        </Button>
      </Form>
    </main>
  );
}
