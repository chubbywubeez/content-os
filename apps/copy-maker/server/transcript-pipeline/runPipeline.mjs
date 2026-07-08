import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  BUILD_GRADING,
  BUILD_QUOTES,
  CHUNKS_DIR,
  CHUNK_INTERPRETATIONS_DIR,
  PRESENTATIONS_DIR,
  REPO_ROOT,
  SCORES_DIR,
  PER_INTERVIEW_DIR,
  ensureDirs,
  jobDir,
} from './paths.mjs'
import {
  cleanRawTranscript,
  parseSpeakerDialogue,
  parseLabeledDialogue,
  dialogueToMarkdown,
  interviewStem,
} from './parseSpeakers.mjs'
import { classifyCallType, callTypeToSpeakerMode } from './classifyCallType.mjs'
import { relabelSpeakersForCall } from './relabelSpeakers.mjs'
import { gradeTranscript, parseScoreSummary } from './grade.mjs'
import { extractQuotesJson } from './extractQuotes.mjs'
import { classifyPersonaStage } from './classifyPersona.mjs'
import { appendQuotesToPersona } from './patchPersona.mjs'
import {
  chunkTranscriptPass1,
  getHypothesisConfigFromEnv,
  interpretChunksPass2,
} from './chunking.mjs'
import { getEffectivePipelinePrompts } from './pipelinePrompts.mjs'
import { enrichSingleLinkedInProfile } from '../interviews-data/linkedinEnrichment.mjs'

const RESOURCE_SYNC_SCRIPT = path.join(
  REPO_ROOT,
  'apps',
  'copy-maker',
  'scripts',
  'generate-resource-downloads.mjs',
)

/**
 * @typedef {{ step: string, status: 'running'|'done'|'error', title: string, message: string, detail?: Record<string, unknown> }} PipelineEvent
 */

/**
 * @param {string} rawText
 * @param {string} originalFilename
 * @param {{ linkedinUrl?: string | null }} [options]
 * @returns {AsyncGenerator<PipelineEvent>}
 */
export async function* runTranscriptPipeline(rawText, originalFilename, options = {}) {
  ensureDirs()
  const prompts = await getEffectivePipelinePrompts()
  const jobId = randomUUID().slice(0, 8)
  const dir = jobDir(jobId)
  fs.mkdirSync(dir, { recursive: true })

  const uploadBase = path.basename(originalFilename || 'call-transcript.txt')

  try {
    yield {
      step: 'upload',
      status: 'running',
      title: 'Upload received',
      message: 'Saving your call transcript…',
    }

    fs.writeFileSync(path.join(dir, 'raw.txt'), rawText, 'utf8')
    const meta = { jobId, originalFilename: uploadBase, startedAt: new Date().toISOString() }
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')

    yield {
      step: 'upload',
      status: 'done',
      title: 'Upload received',
      message: `Saved ${rawText.length.toLocaleString()} characters.`,
      detail: { jobId, filename: uploadBase },
    }

    yield {
      step: 'clean',
      status: 'running',
      title: 'Cleaning transcript',
      message: 'Normalizing line breaks and removing junk characters…',
    }
    const cleaned = cleanRawTranscript(rawText)
    fs.writeFileSync(path.join(dir, 'cleaned.txt'), cleaned, 'utf8')
    yield {
      step: 'clean',
      status: 'done',
      title: 'Cleaning transcript',
      message: 'Text cleaned and ready for call classification.',
      detail: { charCount: cleaned.length },
    }

    yield {
      step: 'classify_call',
      status: 'running',
      title: 'Classify call type',
      message: 'Deciding if this is a problem interview or product demo…',
    }
    const callClassification = await classifyCallType(cleaned, prompts)
    const callType = callClassification.callType
    const speakerMode = callTypeToSpeakerMode(callType, callClassification.speakerMode)
    fs.writeFileSync(
      path.join(dir, 'call-type.json'),
      JSON.stringify({ ...callClassification, callType, speakerMode }, null, 2),
      'utf8',
    )
    yield {
      step: 'classify_call',
      status: 'done',
      title: 'Classify call type',
      message:
        callType === 'demo'
          ? `Product demo (${Math.round(callClassification.confidence * 100)}% confidence).`
          : `Problem interview (${Math.round(callClassification.confidence * 100)}% confidence).`,
      detail: {
        callType,
        speakerMode,
        confidence: callClassification.confidence,
        rationale: callClassification.rationale,
      },
    }

    yield {
      step: 'relabel',
      status: 'running',
      title: 'Relabel speakers',
      message: 'Fixing speaker attribution with AI…',
    }
    const relabelResult = await relabelSpeakersForCall(
      cleaned,
      {
        speakerMode,
        intervieweeHint: callClassification.intervieweeHint,
      },
      prompts,
    )
    fs.writeFileSync(path.join(dir, 'relabeled.txt'), relabelResult.labeledText, 'utf8')
    fs.writeFileSync(
      path.join(dir, 'relabel-meta.json'),
      JSON.stringify(
        {
          callType,
          speakerMode: relabelResult.mode,
          model: relabelResult.model,
          intervieweeHint: relabelResult.intervieweeName,
          intervieweeLabel: relabelResult.intervieweeLabel,
        },
        null,
        2,
      ),
      'utf8',
    )
    yield {
      step: 'relabel',
      status: 'done',
      title: 'Relabel speakers',
      message:
        callType === 'demo'
          ? `Demo relabeled — Brian, Tabarak, and ${relabelResult.intervieweeName}.`
          : `Interview relabeled — Tabarak and ${relabelResult.intervieweeName}.`,
      detail: {
        callType,
        callMode: relabelResult.mode,
        model: relabelResult.model,
        interviewee: relabelResult.intervieweeName,
      },
    }

    yield {
      step: 'speakers',
      status: 'running',
      title: 'Speaker breakdown',
      message: 'Building dialogue markdown from relabeled transcript…',
    }
    let parsed = parseLabeledDialogue(relabelResult.labeledText, {
      title: relabelResult.preview.title,
      dateLine: relabelResult.preview.dateLine,
    })
    if (parsed.turns.length < 2) {
      parsed = parseSpeakerDialogue(cleaned)
    }
    const dialogueMd = dialogueToMarkdown(parsed)
    fs.writeFileSync(path.join(dir, 'dialogue.md'), dialogueMd, 'utf8')
    yield {
      step: 'speakers',
      status: 'done',
      title: 'Speaker breakdown',
      message: `Found ${parsed.speakers.length} speakers, ${parsed.turns.length} turns. Participant: ${parsed.participant}.`,
      detail: {
        callType,
        callMode: relabelResult.mode,
        speakers: parsed.speakers,
        turns: parsed.turns.length,
        participant: parsed.participant,
      },
    }

    const stem = interviewStem(parsed.participant, uploadBase, callType)
    const personId = parsed.participant.toLowerCase().replace(/[^\w]+/g, '_')
    const transcriptId = stem.toLowerCase().replace(/[^\w]+/g, '_')
    const transcriptFileName = `${stem}.md`
    const transcriptPath = path.join(PRESENTATIONS_DIR, transcriptFileName)

    yield {
      step: 'chunk_pass1',
      status: 'running',
      title: 'Chunk transcript',
      message: 'Segmenting transcript into universal semantic chunks…',
    }
    const pass1 = await chunkTranscriptPass1(
      {
        callType,
        turns: parsed.turns,
        intervieweeName: parsed.participant,
        personId,
        transcriptId,
      },
      prompts,
    )
    const chunksPath = path.join(CHUNKS_DIR, `${stem}.chunks.json`)
    fs.writeFileSync(
      chunksPath,
      `${JSON.stringify(
        {
          version: 1,
          generatedAt: new Date().toISOString(),
          stem,
          personId,
          transcriptId,
          callType,
          model: pass1.model,
          chunks: pass1.chunks,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    fs.writeFileSync(path.join(dir, 'chunks.pass1.json'), `${JSON.stringify(pass1.chunks, null, 2)}\n`, 'utf8')
    yield {
      step: 'chunk_pass1',
      status: 'done',
      title: 'Chunk transcript',
      message: `Created ${pass1.chunks.length} chunk(s).`,
      detail: { path: `data/presentations/copy_mining/chunks/${stem}.chunks.json`, count: pass1.chunks.length },
    }

    const hypothesis = getHypothesisConfigFromEnv()
    if (hypothesis) {
      yield {
        step: 'chunk_pass2',
        status: 'running',
        title: 'Interpret chunks',
        message: `Interpreting chunks for hypothesis ${hypothesis.hypothesisVersion}…`,
      }
      const interpretations = await interpretChunksPass2(
        {
          chunks: pass1.chunks,
          hypothesisVersion: hypothesis.hypothesisVersion,
          hypothesisText: hypothesis.hypothesisText,
          icpDefinition: hypothesis.icpDefinition,
          dimensionsList: hypothesis.dimensionsList,
        },
        prompts,
      )
      const intPath = path.join(
        CHUNK_INTERPRETATIONS_DIR,
        `${stem}.${hypothesis.hypothesisVersion}.interpretations.json`,
      )
      fs.writeFileSync(
        intPath,
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            stem,
            hypothesisVersion: hypothesis.hypothesisVersion,
            count: interpretations.length,
            rows: interpretations,
          },
          null,
          2,
        )}\n`,
        'utf8',
      )
      fs.writeFileSync(
        path.join(dir, `chunks.pass2.${hypothesis.hypothesisVersion}.json`),
        `${JSON.stringify(interpretations, null, 2)}\n`,
        'utf8',
      )
      yield {
        step: 'chunk_pass2',
        status: 'done',
        title: 'Interpret chunks',
        message: `Saved ${interpretations.length} interpretation row(s).`,
        detail: {
          path: `data/presentations/copy_mining/chunk_interpretations/${stem}.${hypothesis.hypothesisVersion}.interpretations.json`,
          count: interpretations.length,
          hypothesisVersion: hypothesis.hypothesisVersion,
        },
      }
    } else {
      yield {
        step: 'chunk_pass2',
        status: 'done',
        title: 'Interpret chunks',
        message: 'Skipped — hypothesis config not provided in environment.',
        detail: { skipped: true },
      }
    }

    yield {
      step: 'save_transcript',
      status: 'running',
      title: 'Save interview file',
      message: 'Writing markdown transcript to data/presentations…',
    }
    fs.writeFileSync(transcriptPath, dialogueMd, 'utf8')
    yield {
      step: 'save_transcript',
      status: 'done',
      title: 'Save interview file',
      message: `Wrote ${transcriptFileName}`,
      detail: { path: `data/presentations/${transcriptFileName}`, callType },
    }

    /** @type {{ classification: string | null, composite: number | null, hypothesisPct: string | null }} */
    let scoreSummary = { classification: null, composite: null, hypothesisPct: null }

    if (callType === 'interview') {
      yield {
        step: 'grade',
        status: 'running',
        title: 'Grading interview',
        message: 'Running Vantum scoring rubric (this can take a few minutes)…',
      }
      const scoreMd = await gradeTranscript({ transcriptMd: dialogueMd, transcriptFileName }, prompts)
      const scorePath = path.join(SCORES_DIR, `${stem}.score.md`)
      fs.writeFileSync(scorePath, scoreMd, 'utf8')
      scoreSummary = parseScoreSummary(scoreMd)
      yield {
        step: 'grade',
        status: 'done',
        title: 'Grading interview',
        message: scoreSummary.classification
          ? `${scoreSummary.classification}${scoreSummary.composite != null ? ` · Composite ${scoreSummary.composite}/100` : ''}`
          : 'Score report saved.',
        detail: { scoreFile: `scores/${stem}.score.md`, ...scoreSummary },
      }

      yield {
        step: 'grading_sheet',
        status: 'running',
        title: 'Update grading sheet',
        message: 'Rebuilding ALL_GRADING.md rollup…',
      }
      if (fs.existsSync(BUILD_GRADING)) {
        execSync(`node "${BUILD_GRADING}"`, { cwd: path.dirname(BUILD_GRADING), stdio: 'pipe' })
      }
      yield {
        step: 'grading_sheet',
        status: 'done',
        title: 'Update grading sheet',
        message: 'Grading sheet updated (ALL_GRADING.md).',
        detail: { path: 'data/presentations/scores/ALL_GRADING.md' },
      }
    } else {
      yield {
        step: 'grade',
        status: 'done',
        title: 'Grading interview',
        message: 'Skipped — product demos are not scored with the interview rubric.',
        detail: { skipped: true, callType: 'demo' },
      }
      yield {
        step: 'grading_sheet',
        status: 'done',
        title: 'Update grading sheet',
        message: 'Skipped for demo calls.',
        detail: { skipped: true },
      }
    }

    yield {
      step: 'extract_quotes',
      status: 'running',
      title: 'Extract quotes',
      message: 'Pulling verbatim participant quotes…',
    }
    const quotes = await extractQuotesJson(
      {
        interviewLabel: stem,
        participant: parsed.participant,
        dialogueMd,
        composite: scoreSummary.composite,
      },
      prompts,
    )
    const quotesPath = path.join(PER_INTERVIEW_DIR, `${stem}.json`)
    fs.writeFileSync(quotesPath, `${JSON.stringify(quotes, null, 2)}\n`, 'utf8')
    yield {
      step: 'extract_quotes',
      status: 'done',
      title: 'Extract quotes',
      message: `Saved ${quotes.snippets.length} quotes to per_interview JSON.`,
      detail: { quotesFile: `copy_mining/per_interview/${stem}.json`, count: quotes.snippets.length },
    }

    yield {
      step: 'quote_docs',
      status: 'running',
      title: 'Refresh quote documents',
      message: 'Rebuilding ALL_CUSTOMER_QUOTES_WITH_WEIGHTS.md…',
    }
    if (fs.existsSync(BUILD_QUOTES)) {
      execSync(`node "${BUILD_QUOTES}"`, { cwd: path.dirname(BUILD_QUOTES), stdio: 'pipe' })
    }
    yield {
      step: 'quote_docs',
      status: 'done',
      title: 'Refresh quote documents',
      message: 'Master quote rollup updated.',
      detail: { path: 'data/presentations/copy_mining/ALL_CUSTOMER_QUOTES_WITH_WEIGHTS.md' },
    }

    /** @type {{ persona: string, confidence: number, rationale: string } | null} */
    let personaResult = null
    let personaPatchAdded = 0

    if (callType === 'interview') {
      const scorePath = path.join(SCORES_DIR, `${stem}.score.md`)
      const scoreMd = fs.existsSync(scorePath) ? fs.readFileSync(scorePath, 'utf8') : ''

      yield {
        step: 'classify_persona',
        status: 'running',
        title: 'Classify persona stage',
        message: 'Deciding TOFU / MOFU / BOFU fit…',
      }
      personaResult = await classifyPersonaStage(
        {
          participant: parsed.participant,
          dialogueMd,
          scoreMd,
        },
        prompts,
      )
      yield {
        step: 'classify_persona',
        status: 'done',
        title: 'Classify persona stage',
        message: `${personaResult.persona.toUpperCase()} (${Math.round(personaResult.confidence * 100)}% confidence)`,
        detail: personaResult,
      }

      yield {
        step: 'update_persona',
        status: 'running',
        title: 'Update persona quotes',
        message: `Appending quotes to vantum-persona-${personaResult.persona}.md…`,
      }
      const patch = appendQuotesToPersona({
        persona: personaResult.persona,
        snippets: quotes.snippets,
        sourceLabel: `${stem} · ${personaResult.persona.toUpperCase()} pipeline ${new Date().toISOString().slice(0, 10)}`,
      })
      personaPatchAdded = patch.added
      yield {
        step: 'update_persona',
        status: 'done',
        title: 'Update persona quotes',
        message:
          patch.added > 0
            ? `Added ${patch.added} new quote(s) to ${patch.file}.`
            : 'No new quotes added (duplicates skipped).',
        detail: patch,
      }
    } else {
      yield {
        step: 'classify_persona',
        status: 'done',
        title: 'Classify persona stage',
        message: 'Skipped for demo calls.',
        detail: { skipped: true },
      }
      yield {
        step: 'update_persona',
        status: 'done',
        title: 'Update persona quotes',
        message: 'Skipped for demo calls.',
        detail: { skipped: true },
      }
    }

    if (callType === 'interview' && personaPatchAdded > 0) {
      yield {
        step: 'sync_resources',
        status: 'running',
        title: 'Sync resources',
        message: 'Refreshing resource markdown/json files from latest persona updates…',
      }
      if (fs.existsSync(RESOURCE_SYNC_SCRIPT)) {
        execSync(`node "${RESOURCE_SYNC_SCRIPT}"`, {
          cwd: path.dirname(RESOURCE_SYNC_SCRIPT),
          stdio: 'pipe',
        })
        yield {
          step: 'sync_resources',
          status: 'done',
          title: 'Sync resources',
          message: 'Resources updated (.md and .json).',
          detail: { script: 'apps/copy-maker/scripts/generate-resource-downloads.mjs' },
        }
      } else {
        yield {
          step: 'sync_resources',
          status: 'done',
          title: 'Sync resources',
          message: 'Skipped — resource sync script was not found.',
          detail: { skipped: true, script: RESOURCE_SYNC_SCRIPT },
        }
      }
    } else {
      yield {
        step: 'sync_resources',
        status: 'done',
        title: 'Sync resources',
        message: 'Skipped — no persona changes to publish.',
        detail: { skipped: true, callType, personaPatchAdded },
      }
    }

    const personaMetaPath = path.join(PER_INTERVIEW_DIR, `${stem}.meta.json`)
    fs.writeFileSync(
      personaMetaPath,
      `${JSON.stringify(
        {
          stem,
          callType,
          speakerMode,
          participant: parsed.participant,
          callTypeConfidence: callClassification.confidence,
          callTypeRationale: callClassification.rationale,
          persona: personaResult?.persona ?? null,
          confidence: personaResult?.confidence ?? null,
          rationale: personaResult?.rationale ?? callClassification.rationale,
          classifiedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

    const finalMeta = {
      ...meta,
      completedAt: new Date().toISOString(),
      stem,
      callType,
      participant: parsed.participant,
      persona: personaResult?.persona ?? null,
      scoreSummary,
    }
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(finalMeta, null, 2), 'utf8')

    const linkedinUrl = String(options.linkedinUrl || '').trim()
    if (linkedinUrl) {
      yield {
        step: 'linkedin_enrich',
        status: 'running',
        title: 'LinkedIn enrichment',
        message: 'Scraping LinkedIn profile and syncing to Supabase…',
      }
      const linkedInResult = await enrichSingleLinkedInProfile({
        linkedinUrl,
        fallbackName: parsed.participant,
        personaStage: personaResult?.persona ?? null,
        source: 'transcript_pipeline',
      })
      yield {
        step: 'linkedin_enrich',
        status: 'done',
        title: 'LinkedIn enrichment',
        message:
          linkedInResult?.status === 'updated'
            ? 'LinkedIn data attached to an existing person.'
            : linkedInResult?.status === 'inserted'
              ? 'LinkedIn data added and a new person was created.'
              : 'LinkedIn profile was not found in scrape output.',
        detail: linkedInResult,
      }
    } else {
      yield {
        step: 'linkedin_enrich',
        status: 'done',
        title: 'LinkedIn enrichment',
        message: 'Skipped — no LinkedIn URL was provided.',
        detail: { skipped: true },
      }
    }

    yield {
      step: 'complete',
      status: 'done',
      title: 'Pipeline complete',
      message: `All steps finished for ${parsed.participant}.`,
      detail: finalMeta,
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    yield {
      step: 'error',
      status: 'error',
      title: 'Pipeline stopped',
      message: err,
      detail: { jobId },
    }
  }
}
