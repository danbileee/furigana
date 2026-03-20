import type { FuriganaToken } from "~/schema/furigana.schema";

type ReadingViewProps = {
  tokens: FuriganaToken[];
};

export function ReadingView({ tokens }: ReadingViewProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-8">
      <article className="border-border bg-card w-full rounded-lg border p-6 text-xl leading-relaxed">
        {tokens.map((token, index) =>
          token.type === "ruby" ? (
            <ruby key={`${token.kanji}-${token.yomi}-${index}`}>
              {token.kanji}
              <rt>{token.yomi}</rt>
            </ruby>
          ) : (
            <span key={`${token.value}-${index}`}>{token.value}</span>
          ),
        )}
      </article>
    </main>
  );
}
