/**
 * Human-readable catalog of what each test suite measures.
 *
 * SOURCE OF TRUTH is the Skulk test harness (`configs/test_sets.yaml`, where
 * every suite carries a one-line `description`). This catalog restates that and
 * adds a fuller "what it checks / what passing means" blurb the terse config
 * line does not carry, plus a friendly title and a coarse category for
 * grouping. The importer bakes these onto each `SuiteRollup`.
 *
 * Two layers feed a suite's shown description, resolved in the importer:
 *   1. the description the harness now stamps into each run's report (a run is
 *      self-describing, so a community submission or a brand-new suite explains
 *      itself even before this catalog knows it);
 *   2. this catalog, as the fallback that covers the entire historical archive
 *      (older reports predate the emitted description) and supplies the richer
 *      `title` / `measures` / `category` the report does not carry.
 *
 * Keys are the canonical test-set names. A suite with no entry here still
 * renders (its name, plus any report-carried description); it simply lacks the
 * richer prose until an entry is added. When the harness adds or renames a
 * suite, add the matching entry here.
 */

/** Coarse grouping for a suite, used for a category chip. */
export type SuiteCategory =
  | 'text'
  | 'code'
  | 'tools'
  | 'performance'
  | 'reliability'
  | 'speech'
  | 'embeddings'
  | 'vision';

/** One suite's explanatory metadata. */
export interface SuiteCatalogEntry {
  /** Friendly display title (the card still shows the raw suite name too). */
  title: string;
  /** One-line summary of what the suite is. */
  blurb: string;
  /** Fuller explanation: what it exercises and what passing actually means. */
  measures: string;
  category: SuiteCategory;
}

export const SUITE_CATALOG: Record<string, SuiteCatalogEntry> = {
  'chat-tests': {
    title: 'Chat sanity',
    blurb: 'General chat and instruction-following.',
    measures:
      'Sends plain chat prompts and checks the model answers the actual question and obeys simple formatting instructions: a direct factual answer, an exact bullet count, and a run of integers emitted in order. Passing means coherent, on-instruction output, not just non-empty text.',
    category: 'text',
  },
  'code-tests': {
    title: 'Code generation',
    blurb: 'Code prompts with simple artifact checks.',
    measures:
      'Asks for a small, well-specified program and verifies the reply contains a real fenced code block of meaningful length with the requested function present. It is a smoke test that a model produces usable code structure, not a full correctness or execution grader.',
    category: 'code',
  },
  'tool-tests': {
    title: 'Tool calling',
    blurb: 'OpenAI-style function calls against static mocks.',
    measures:
      'Exercises function calling: a forced single tool call, automatic routing to the right tool among several, and parallel calls across two arguments. Mocked tool results are fed back so the follow-up answer can be checked. Passing means the model emits the expected calls with the right arguments and uses the results.',
    category: 'tools',
  },
  throughput: {
    title: 'Decode throughput',
    blurb: 'Sustained-generation decode speed smoke benchmark.',
    measures:
      'Drives a long, list-free generation several times to measure sustained decode tokens per second under a steady load. It is the headline throughput signal on the ledger; passing requires a substantial body of output so the rate reflects real decoding rather than a warmup blip.',
    category: 'performance',
  },
  cancellation: {
    title: 'Stream cancellation',
    blurb: 'Cancel mid-stream, then confirm the node still serves.',
    measures:
      'Starts a long streamed response, cancels it partway, then issues a healthy follow-up request on the same node. Passing means the cancel is honored and the follow-up succeeds, proving cancellation cleans up without wedging the runner or leaking the stream.',
    category: 'reliability',
  },
  'context-admission': {
    title: 'Context admission',
    blurb: "Oversized-request guard for the context ceiling.",
    measures:
      'Sends a request that deliberately asks for more output tokens than the context ceiling allows and expects a clean rejection (an HTTP 400 naming the limit), followed by a healthy request. Passing means the guard refuses the oversized request gracefully instead of crashing or hanging the node.',
    category: 'reliability',
  },
  embeddings: {
    title: 'Embeddings',
    blurb: 'Embeddings endpoint with vector shape and norm checks.',
    measures:
      'Calls the embeddings endpoint and checks the returned vector has the expected dimensionality and a non-trivial magnitude. Passing means the endpoint returns a well-formed embedding of the right shape, not an empty or degenerate vector.',
    category: 'embeddings',
  },
  vision: {
    title: 'Vision',
    blurb: 'Multimodal chat with an image input part.',
    measures:
      'Sends a chat request that includes an OpenAI-style image part and checks the model responds coherently about the image. Passing means the multimodal path accepts the image and produces relevant text, exercising the projector and image handling end to end.',
    category: 'vision',
  },
  'served-speculation': {
    title: 'Served speculation',
    blurb: 'Correctness gate for llama_server speculative variants.',
    measures:
      'A generic correctness check run against served-backend speculation setups (draft models, MTP). It confirms speculative decoding produces correct, coherent output rather than corrupting the stream. Passing means acceptance-driven speed does not come at the cost of wrong tokens.',
    category: 'performance',
  },
  'speech-synthesis': {
    title: 'Text to speech',
    blurb: 'TTS endpoint with binary audio checks.',
    measures:
      'Sends text to the speech endpoint and verifies a non-trivial block of encoded audio comes back. Passing means the TTS path renders real audio bytes, not an empty or truncated response.',
    category: 'speech',
  },
  'speech-synthesis-streaming': {
    title: 'Streaming TTS',
    blurb: 'Experimental streaming text to speech.',
    measures:
      'Requests streamed speech and checks audio arrives progressively across multiple chunks over a real time span, not as one blob at the end. Requires experimental mode and a card that declares streaming support. Passing means genuine progressive delivery.',
    category: 'speech',
  },
  'speech-data-pressure': {
    title: 'Speech data pressure',
    blurb: 'Concurrent streaming TTS for data-plane isolation.',
    measures:
      'Runs many concurrent speech streams across API owners, deliberately slowing one reader, and asserts the data-plane diagnostics show streams stay isolated. Passing means one slow or stalled stream does not starve or stall the others, proving per-command queue isolation.',
    category: 'speech',
  },
  'speech-roundtrip': {
    title: 'Speech roundtrip',
    blurb: 'Text to speech, then speech back to text.',
    measures:
      'Synthesizes speech from text, then transcribes that audio back and checks the transcript recovers the intended content. Passing means the TTS and STT paths compose into a faithful roundtrip rather than drifting or dropping the message.',
    category: 'speech',
  },
  'realtime-transcription': {
    title: 'Realtime transcription',
    blurb: 'Semantic realtime speech to text.',
    measures:
      'Streams PCM audio into the realtime transcription session and checks the incremental transcript captures the expected content, optionally with server voice-activity detection and a cancellation probe. Passing means the live streaming STT path yields a semantically correct transcript.',
    category: 'speech',
  },
  'conversational-realtime': {
    title: 'Conversational realtime',
    blurb: 'Persistent realtime voice loop with server VAD.',
    measures:
      'Holds a persistent realtime voice session across multiple turns with server voice-activity detection, exercising turn-taking and barge-in. Passing means the loop segments speech into turns and responds correctly across the conversation, not just a single utterance.',
    category: 'speech',
  },
  'fabric-speech-chain': {
    title: 'Fabric speech chain',
    blurb: 'Typed speech-to-chat-to-speech composition.',
    measures:
      'Drives the explicit speech-to-text to chat to text-to-speech composition surface and checks the typed chain runs end to end. Passing means the composed session transcribes input, routes it through a chat model, and speaks the reply without breaking the typed contract.',
    category: 'speech',
  },

  // Historical / benchmark-battery suites that appear in the archive but are
  // not in the current public config. Described here so the ledger explains
  // them too; grounded in the harness example configs where they are defined.
  'llama-cpp': {
    title: 'llama.cpp engine',
    blurb: 'Capability and coherence checks for the GGUF (llama.cpp) engine.',
    measures:
      'Exercises the llama.cpp / GGUF engine on a non-Mac GPU node: basic generation, streamed-order coherence, the tool-calling path, and harmony marker-leak guards. Passing means the GGUF engine produces coherent, correctly-ordered output and does not leak channel markers.',
    category: 'reliability',
  },
  'mtp-correctness': {
    title: 'Served MTP correctness',
    blurb: 'Correctness gates for the served speculative (MTP) path.',
    measures:
      'Checks the served multi-token-prediction path stays correct, tolerating reasoning models that spend the budget in reasoning content: presence and throughput are scored across visible plus separated reasoning, while marker checks guard parser regressions. Passing means speculation does not corrupt output.',
    category: 'reliability',
  },
  'mtp-benchmark': {
    title: 'MTP on/off benchmark',
    blurb: 'Speculative-decoding on-vs-off throughput for the served engine.',
    measures:
      'Runs a fixed greedy 200-token completion three times through the production API to measure decode tokens per second, once with served MTP on and once forced off, so the speedup from speculation is directly measurable on the same model and node. The value is the throughput comparison.',
    category: 'performance',
  },
  'multinode-cost': {
    title: 'Multi-node cost',
    blurb: 'One neutral sustained-generation test for multi-node cost.',
    measures:
      'A single deterministic greedy 300-token generation, median of three reps with a family-neutral prompt, used to measure decode throughput for the multi-node cost benchmark without cache or GC skew. Passing requires a low character floor so the number is captured even from a terse model.',
    category: 'performance',
  },
  'gpt-oss-20b-complete': {
    title: 'GPT-OSS 20B complete',
    blurb: 'Broad GPT-OSS 20B suite across chat, reasoning, code, and tools.',
    measures:
      'A wide battery for GPT-OSS 20B covering chat, reasoning-effort controls, code generation, HTML artifacts, and OpenAI-style tool calls. Passing means the model handles the full spread of capabilities, not one narrow path.',
    category: 'text',
  },
  'asteroids-challenge': {
    title: 'Asteroids challenge',
    blurb: 'Generate a playable single-file Asteroids HTML canvas game.',
    measures:
      'Asks the model to produce a complete, playable single-file Asteroids-style HTML canvas game. Passing means a substantial, self-contained HTML artifact is produced: a stress test of long, structured code generation.',
    category: 'code',
  },
  'streaming-transcription': {
    title: 'Streaming transcription',
    blurb: 'Uploaded-audio streaming speech to text.',
    measures:
      'Synthesizes a semantic WAV, streams it to transcription, and requires multiple model-produced incremental transcript events plus completed and usage terminals, with an early-close cancellation probe. Passing means the streaming STT path emits real deltas and terminates cleanly.',
    category: 'speech',
  },
  'speech-voice-catalog': {
    title: 'Voice catalog',
    blurb: 'Lists static voices and synthesizes with a named voice.',
    measures:
      "Lists a TTS model's static voices and synthesizes audio using a named voice. Passing means the voice catalog is exposed and a requested voice renders audio.",
    category: 'speech',
  },
  'speech-reference-conditioning': {
    title: 'Reference conditioning',
    blurb: 'Voice conditioning from an uploaded reference clip.',
    measures:
      'Generates a request-scoped donor clip and sends it through multipart reference conditioning on the speech endpoint, retaining both audio artifacts. Passing means the TTS model accepts a reference clip and conditions its output on it.',
    category: 'speech',
  },
  'speech-translation': {
    title: 'Speech translation',
    blurb: 'Speech translated to English text.',
    measures:
      'Synthesizes a deterministic French utterance, mounts a translation-capable transcription model through the store, and requires an English translation of it. Passing means the translation path recovers the meaning in English.',
    category: 'speech',
  },
  'speech-roundtrip-parakeet': {
    title: 'Speech roundtrip (Parakeet)',
    blurb: 'Speech roundtrip using a Parakeet transcriber.',
    measures:
      'Synthesizes speech from text and transcribes it back with a Parakeet speech-to-text model, checking the transcript recovers the intended content: a transcriber-specific variant of the speech roundtrip. Passing means the TTS and STT paths compose faithfully.',
    category: 'speech',
  },
};

/** Look up a suite's catalog entry by its canonical test-set name. */
export function suiteCatalogEntry(testSet: string): SuiteCatalogEntry | null {
  return SUITE_CATALOG[testSet] ?? null;
}
