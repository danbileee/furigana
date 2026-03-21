import { data, useLoaderData } from "react-router";
import type { Route } from "./+types/furigana.$id";
import { consumeTokens } from "~/services/token-storage.service";
import type { FuriganaToken } from "~/schema/furigana.schema";

type LoaderData = {
  tokens: FuriganaToken[];
};

export async function loader({ params }: Route.LoaderArgs) {
  const tokens = consumeTokens(params.id);

  if (tokens !== null) {
    return data<LoaderData>({ tokens: tokens ?? [] });
  }

  // TODO(milestone-2): Fetch tokens from TursoDB when storage param is absent.
  return data<LoaderData>({ tokens: [] });
}

export default function FuriganaById() {
  const { tokens } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-8">
      <article
        lang="ja"
        className="border-border bg-card w-full rounded-lg border p-6 text-xl leading-relaxed"
      >
        {tokens.map((token, index) =>
          token.type === "ruby" ? (
            <ruby key={`${token.kanji}-${token.yomi}-${index}`}>
              {token.kanji}
              <rp>(</rp>
              <rt>{token.yomi}</rt>
              <rp>)</rp>
            </ruby>
          ) : (
            <span key={`${token.value}-${index}`}>{token.value}</span>
          ),
        )}
      </article>
    </main>
  );
}
